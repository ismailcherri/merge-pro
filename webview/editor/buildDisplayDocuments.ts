import { resolvedChunkLines, type ConflictChunk } from '../../src/protocol'

function splitLines(text: string): string[] {
    const lines = text.replaceAll('\r\n', '\n').split('\n')
    if (lines.at(-1) === '') lines.pop()
    return lines
}

export interface LineRange {
    /** 1-indexed Monaco line where the chunk starts in the document. */
    start: number
    /** 1-indexed Monaco line where the chunk ends (inclusive). 0 means empty range at `start`. */
    end: number
}

export interface ChunkLineMap {
    ours: LineRange
    result: LineRange
    theirs: LineRange
}

export interface DisplayDocuments {
    ours: string
    result: string
    theirs: string
    /** Parallel to the input `chunks` array (NOT to a sorted copy). */
    chunkMaps: ChunkLineMap[]
}

function resolveChunkLines(chunk: ConflictChunk): string[] {
    if (chunk.manualLines !== undefined) return chunk.manualLines
    if (
        chunk.oursDecision !== undefined ||
        chunk.theirsDecision !== undefined
    ) {
        return resolvedChunkLines(chunk)
    }
    if (chunk.type === 'non-conflicting') {
        if (chunk.winner === 'ours') return chunk.oursLines
        if (chunk.winner === 'theirs') return chunk.theirsLines
    }
    return chunk.baseLines
}

/**
 * Build three independent display documents from the actual ours/base/theirs
 * file contents. No padding — each pane shows its real content. For each
 * chunk we record the (1-indexed inclusive) line range it occupies in each
 * of the three docs so the gutter can draw connectors between them and the
 * scroll-sync layer can map a line in one pane to the corresponding line
 * in another.
 *
 * Strategy: chunks are sorted by baseStartLine. We walk them in order,
 * tracking three independent line cursors (one per output document) plus a
 * base-file cursor. Unchanged base regions between chunks are copied
 * identically into all three docs (advancing all cursors by the same N).
 * Inside a chunk we emit each pane's own slice and advance only that
 * pane's cursor by the slice length.
 */
export function buildDisplayDocuments(
    oursText: string,
    baseText: string,
    theirsText: string,
    chunks: ConflictChunk[]
): DisplayDocuments {
    const oursAllLines = splitLines(oursText)
    const baseLines = splitLines(baseText)
    const theirsAllLines = splitLines(theirsText)

    // Sort copy for traversal but record maps in the *original* index order.
    const sorted = chunks
        .map((chunk, idx) => ({ chunk, idx }))
        .sort((a, b) => a.chunk.baseStartLine - b.chunk.baseStartLine)

    const oursParts: string[] = []
    const resultParts: string[] = []
    const theirsParts: string[] = []
    const chunkMaps: ChunkLineMap[] = new Array<ChunkLineMap>(chunks.length)

    // Per-document line cursors (count of lines emitted so far). The next
    // pushed line will appear at line number `<cursor> + 1`.
    let oursLine = 0
    let resultLine = 0
    let theirsLine = 0

    // We need ours/theirs slice ranges that mirror the base region. We
    // approximate ours/theirs unchanged regions as having the same length
    // as the base unchanged region — this holds as long as conflict chunks
    // capture every divergent region, which is true for the parser's output.
    let baseCursor = 0
    let oursCursor = 0
    let theirsCursor = 0

    for (const { chunk, idx } of sorted) {
        const unchangedLen = chunk.baseStartLine - baseCursor
        if (unchangedLen > 0) {
            const baseSlice = baseLines.slice(baseCursor, chunk.baseStartLine)
            const oursSlice = oursAllLines.slice(
                oursCursor,
                oursCursor + unchangedLen
            )
            const theirsSlice = theirsAllLines.slice(
                theirsCursor,
                theirsCursor + unchangedLen
            )
            // Fall back to base slice if ours/theirs ran short for any reason.
            oursParts.push(
                ...(oursSlice.length === unchangedLen ? oursSlice : baseSlice)
            )
            resultParts.push(...baseSlice)
            theirsParts.push(
                ...(theirsSlice.length === unchangedLen
                    ? theirsSlice
                    : baseSlice)
            )
            oursLine += unchangedLen
            resultLine += unchangedLen
            theirsLine += unchangedLen
            oursCursor += unchangedLen
            theirsCursor += unchangedLen
            baseCursor += unchangedLen
        }

        const resolved = resolveChunkLines(chunk)

        const oursStart = oursLine + 1
        const resultStart = resultLine + 1
        const theirsStart = theirsLine + 1

        oursParts.push(...chunk.oursLines)
        resultParts.push(...resolved)
        theirsParts.push(...chunk.theirsLines)

        oursLine += chunk.oursLines.length
        resultLine += resolved.length
        theirsLine += chunk.theirsLines.length

        chunkMaps[idx] = {
            ours: { start: oursStart, end: oursLine },
            result: { start: resultStart, end: resultLine },
            theirs: { start: theirsStart, end: theirsLine },
        }

        // Advance the source cursors past this chunk.
        const baseLen = chunk.baseEndLine - chunk.baseStartLine
        oursCursor += chunk.oursLines.length
        theirsCursor += chunk.theirsLines.length
        baseCursor += baseLen
    }

    // Tail after last chunk.
    const tailBase = baseLines.slice(baseCursor)
    const tailOurs = oursAllLines.slice(oursCursor)
    const tailTheirs = theirsAllLines.slice(theirsCursor)
    oursParts.push(...(tailOurs.length ? tailOurs : tailBase))
    resultParts.push(...tailBase)
    theirsParts.push(...(tailTheirs.length ? tailTheirs : tailBase))

    return {
        ours: oursParts.join('\n'),
        result: resultParts.join('\n'),
        theirs: theirsParts.join('\n'),
        chunkMaps,
    }
}
