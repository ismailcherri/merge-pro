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

export function parse(
    oursText: string,
    baseText: string,
    theirsText: string
): ConflictChunk[] {
    if (!oursText && !baseText && !theirsText) return []

    const baseLines = splitLines(baseText)
    const oursHunks = extractHunks(baseText, oursText, 'ours')
    const theirsHunks = extractHunks(baseText, theirsText, 'theirs')

    const chunks: ConflictChunk[] = []
    const usedTheirs = new Set<number>()

    for (const ours of oursHunks) {
        const conflictingTheirsIdx = theirsHunks.findIndex(
            (t, i) => !usedTheirs.has(i) && overlaps(ours, t)
        )

        if (conflictingTheirsIdx !== -1) {
            const theirs = theirsHunks[conflictingTheirsIdx]
            usedTheirs.add(conflictingTheirsIdx)

            // Both sides agree on the same output — not a real conflict
            if (arraysEqual(ours.newLines, theirs.newLines)) {
                chunks.push({
                    type: 'non-conflicting',
                    oursLines: ours.newLines,
                    baseLines: baseLines.slice(
                        Math.min(ours.baseStart, theirs.baseStart),
                        Math.max(ours.baseEnd, theirs.baseEnd)
                    ),
                    theirsLines: theirs.newLines,
                    baseStartLine: Math.min(ours.baseStart, theirs.baseStart),
                    baseEndLine: Math.max(ours.baseEnd, theirs.baseEnd),
                    winner: 'ours',
                })
            } else {
                chunks.push({
                    type: 'conflict',
                    oursLines: ours.newLines,
                    baseLines: baseLines.slice(
                        Math.min(ours.baseStart, theirs.baseStart),
                        Math.max(ours.baseEnd, theirs.baseEnd)
                    ),
                    theirsLines: theirs.newLines,
                    baseStartLine: Math.min(ours.baseStart, theirs.baseStart),
                    baseEndLine: Math.max(ours.baseEnd, theirs.baseEnd),
                })
            }
        } else {
            chunks.push({
                type: 'non-conflicting',
                oursLines: ours.newLines,
                baseLines: baseLines.slice(ours.baseStart, ours.baseEnd),
                theirsLines: baseLines.slice(ours.baseStart, ours.baseEnd),
                baseStartLine: ours.baseStart,
                baseEndLine: ours.baseEnd,
                winner: 'ours',
            })
        }
    }

    // Remaining theirs hunks that didn't conflict with any ours hunk
    theirsHunks.forEach((theirs, i) => {
        if (usedTheirs.has(i)) return
        chunks.push({
            type: 'non-conflicting',
            oursLines: baseLines.slice(theirs.baseStart, theirs.baseEnd),
            baseLines: baseLines.slice(theirs.baseStart, theirs.baseEnd),
            theirsLines: theirs.newLines,
            baseStartLine: theirs.baseStart,
            baseEndLine: theirs.baseEnd,
            winner: 'theirs',
        })
    })

    const sorted = chunks.sort((a, b) => a.baseStartLine - b.baseStartLine)
    return coalesceChunks(sorted, baseLines)
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
