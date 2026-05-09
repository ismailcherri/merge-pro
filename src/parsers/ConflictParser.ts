import { diffLines } from 'diff'
import type { ConflictChunk } from '../protocol'

interface Hunk {
    baseStart: number // 0-indexed, inclusive
    baseEnd: number // 0-indexed, exclusive
    newLines: string[]
    side: 'ours' | 'theirs'
}

function arraysEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i])
}

function splitLines(text: string): string[] {
    // Normalize CRLF, then split
    const lines = text.replace(/\r\n/g, '\n').split('\n')
    // Remove trailing empty element from trailing newline
    if (lines[lines.length - 1] === '') lines.pop()
    return lines
}

function extractHunks(
    baseText: string,
    changedText: string,
    side: 'ours' | 'theirs'
): Hunk[] {
    const normalBase = baseText.replace(/\r\n/g, '\n').replace(/\n$/, '')
    const normalChanged = changedText.replace(/\r\n/g, '\n').replace(/\n$/, '')
    const changes = diffLines(normalBase, normalChanged)
    const hunks: Hunk[] = []
    let basePos = 0

    for (let i = 0; i < changes.length; i++) {
        const c = changes[i]
        const count = c.count ?? splitLines(c.value).length

        if (!c.added && !c.removed) {
            basePos += count
            continue
        }

        if (c.removed) {
            const baseStart = basePos
            basePos += count
            let newLines: string[] = []
            // Consume adjacent "added" as replacement
            if (i + 1 < changes.length && changes[i + 1].added) {
                i++
                newLines = splitLines(changes[i].value)
            }
            hunks.push({ baseStart, baseEnd: basePos, newLines, side })
        } else if (c.added) {
            // Pure insertion — zero-length base range
            hunks.push({
                baseStart: basePos,
                baseEnd: basePos,
                newLines: splitLines(c.value),
                side,
            })
        }
    }

    return hunks
}

function overlaps(a: Hunk, b: Hunk): boolean {
    // Two ranges [a.baseStart, a.baseEnd) and [b.baseStart, b.baseEnd) overlap
    // when they share at least one line, OR both are insertions at the same point.
    if (a.baseStart === a.baseEnd && b.baseStart === b.baseEnd) {
        return a.baseStart === b.baseStart
    }
    return a.baseStart < b.baseEnd && b.baseStart < a.baseEnd
}

/**
 * Reconstructs one side's content for a chunk's full base range by walking
 * the side's hunks in order: contribute each hunk's newLines, and fill the
 * gaps between hunks (within the chunk's range) with the corresponding base
 * lines, which are unchanged in this side by definition.
 */
function reconstructSide(
    hunks: Hunk[],
    baseStart: number,
    baseEnd: number,
    baseLines: string[]
): string[] {
    if (hunks.length === 0) return baseLines.slice(baseStart, baseEnd)
    const out: string[] = []
    let cursor = baseStart
    for (const h of hunks) {
        if (cursor < h.baseStart) {
            out.push(...baseLines.slice(cursor, h.baseStart))
        }
        out.push(...h.newLines)
        cursor = h.baseEnd
    }
    if (cursor < baseEnd) {
        out.push(...baseLines.slice(cursor, baseEnd))
    }
    return out
}

export function parse(
    oursText: string,
    baseText: string,
    theirsText: string
): ConflictChunk[] {
    if (!oursText && !baseText && !theirsText) return []

    const baseLines = splitLines(baseText)
    const oursHunks = extractHunks(baseText, oursText, 'ours')
    const theirsHunks = extractHunks(baseText, theirsText, 'theirs')

    // Clusters overlapping hunks from both sides into a single conflict
    // region. Both lists are sorted by baseStart from extractHunks. We build
    // each cluster by repeatedly absorbing hunks whose base range touches
    // the cluster's accumulated range, from either side, until no more do.
    const chunks: ConflictChunk[] = []
    let oi = 0
    let ti = 0
    while (oi < oursHunks.length || ti < theirsHunks.length) {
        const o = oursHunks[oi]
        const t = theirsHunks[ti]
        let baseStart: number
        let baseEnd: number
        const clusterOurs: Hunk[] = []
        const clusterTheirs: Hunk[] = []

        if (!t || (o && o.baseStart <= t.baseStart)) {
            clusterOurs.push(o)
            baseStart = o.baseStart
            baseEnd = o.baseEnd
            oi++
        } else {
            clusterTheirs.push(t)
            baseStart = t.baseStart
            baseEnd = t.baseEnd
            ti++
        }

        for (;;) {
            let extended = false
            while (
                oi < oursHunks.length &&
                overlapsRange(oursHunks[oi], baseStart, baseEnd)
            ) {
                const h = oursHunks[oi++]
                clusterOurs.push(h)
                baseEnd = Math.max(baseEnd, h.baseEnd)
                extended = true
            }
            while (
                ti < theirsHunks.length &&
                overlapsRange(theirsHunks[ti], baseStart, baseEnd)
            ) {
                const h = theirsHunks[ti++]
                clusterTheirs.push(h)
                baseEnd = Math.max(baseEnd, h.baseEnd)
                extended = true
            }
            if (!extended) break
        }

        const oursLines = reconstructSide(
            clusterOurs,
            baseStart,
            baseEnd,
            baseLines
        )
        const theirsLines = reconstructSide(
            clusterTheirs,
            baseStart,
            baseEnd,
            baseLines
        )
        const chunkBaseLines = baseLines.slice(baseStart, baseEnd)

        const oursChanged = !arraysEqual(oursLines, chunkBaseLines)
        const theirsChanged = !arraysEqual(theirsLines, chunkBaseLines)

        if (oursChanged && theirsChanged) {
            if (arraysEqual(oursLines, theirsLines)) {
                chunks.push({
                    type: 'non-conflicting',
                    oursLines,
                    baseLines: chunkBaseLines,
                    theirsLines,
                    baseStartLine: baseStart,
                    baseEndLine: baseEnd,
                    winner: 'ours',
                })
            } else {
                chunks.push({
                    type: 'conflict',
                    oursLines,
                    baseLines: chunkBaseLines,
                    theirsLines,
                    baseStartLine: baseStart,
                    baseEndLine: baseEnd,
                })
            }
        } else if (oursChanged) {
            chunks.push({
                type: 'non-conflicting',
                oursLines,
                baseLines: chunkBaseLines,
                theirsLines,
                baseStartLine: baseStart,
                baseEndLine: baseEnd,
                winner: 'ours',
            })
        } else {
            chunks.push({
                type: 'non-conflicting',
                oursLines,
                baseLines: chunkBaseLines,
                theirsLines,
                baseStartLine: baseStart,
                baseEndLine: baseEnd,
                winner: 'theirs',
            })
        }
    }

    return coalesceChunks(chunks, baseLines)
}

function overlapsRange(h: Hunk, baseStart: number, baseEnd: number): boolean {
    // Treat insertions at exactly baseEnd as touching/overlapping so they get
    // pulled into the cluster (otherwise we'd leave them as a separate chunk
    // immediately adjacent, and coalesceChunks would merge them anyway).
    if (h.baseStart === h.baseEnd) {
        return h.baseStart >= baseStart && h.baseStart <= baseEnd
    }
    return h.baseStart < baseEnd && baseStart < h.baseEnd
}

/**
 * Merge consecutive chunks whose base ranges touch or overlap so that a single
 * logical conflict region (as git would surround with one set of conflict
 * markers) is represented by one chunk. Without this, minimal line-diff
 * fragments a conflict into several small chunks and the gutter highlighting
 * misses lines that should be part of the conflict.
 */
function coalesceChunks(
    chunks: ConflictChunk[],
    baseLines: string[]
): ConflictChunk[] {
    if (chunks.length <= 1) return chunks
    const out: ConflictChunk[] = []
    let cur = chunks[0]
    for (let i = 1; i < chunks.length; i++) {
        const next = chunks[i]
        if (next.baseStartLine <= cur.baseEndLine) {
            cur = mergeChunks(cur, next, baseLines)
        } else {
            out.push(cur)
            cur = next
        }
    }
    out.push(cur)
    return out
}

function mergeChunks(
    a: ConflictChunk,
    b: ConflictChunk,
    baseLines: string[]
): ConflictChunk {
    const baseStart = Math.min(a.baseStartLine, b.baseStartLine)
    const baseEnd = Math.max(a.baseEndLine, b.baseEndLine)
    // Bridge: any unchanged base lines between a and b. Negative when ranges
    // overlap — in that case we contribute no bridge content.
    const bridge =
        b.baseStartLine > a.baseEndLine
            ? baseLines.slice(a.baseEndLine, b.baseStartLine)
            : []
    const oursLines = [...a.oursLines, ...bridge, ...b.oursLines]
    const theirsLines = [...a.theirsLines, ...bridge, ...b.theirsLines]
    const mergedBase = baseLines.slice(baseStart, baseEnd)
    const isConflict = a.type === 'conflict' || b.type === 'conflict'
    const merged: ConflictChunk = {
        type: isConflict ? 'conflict' : 'non-conflicting',
        oursLines,
        baseLines: mergedBase,
        theirsLines,
        baseStartLine: baseStart,
        baseEndLine: baseEnd,
    }
    if (!isConflict) {
        // Both non-conflicting: pick a consistent winner. If they disagree,
        // fall back to ours (arbitrary but harmless — auto-resolve will set
        // both decisions explicitly later).
        merged.winner =
            a.winner && b.winner && a.winner !== b.winner
                ? 'ours'
                : (a.winner ?? b.winner ?? 'ours')
    }
    return merged
}
