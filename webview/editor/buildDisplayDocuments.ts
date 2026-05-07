import type { ConflictChunk } from '../../src/protocol'

function splitLines(text: string): string[] {
    const lines = text.replace(/\r\n/g, '\n').split('\n')
    if (lines[lines.length - 1] === '') lines.pop()
    return lines
}

function pad(lines: string[], length: number): string[] {
    const padded = [...lines]
    while (padded.length < length) padded.push('')
    return padded
}

interface DisplayDocuments {
    ours: string
    result: string
    theirs: string
}

function resolveChunkLines(chunk: ConflictChunk): string[] {
    if (chunk.resolvedWith === 'ours') return chunk.oursLines
    if (chunk.resolvedWith === 'theirs') return chunk.theirsLines
    if (chunk.resolvedWith === 'manual' && chunk.manualLines) return chunk.manualLines
    if (chunk.type === 'non-conflicting') {
        if (chunk.winner === 'ours') return chunk.oursLines
        if (chunk.winner === 'theirs') return chunk.theirsLines
    }
    return chunk.baseLines
}

/**
 * Build three display documents with identical line counts by padding
 * each conflict chunk to max(ours, result, theirs) height. Unchanged base
 * regions are copied identically to all three documents.
 * The result document reflects current chunk resolution decisions.
 */
export function buildDisplayDocuments(
    fullBaseText: string,
    chunks: ConflictChunk[]
): DisplayDocuments {
    const baseLines = splitLines(fullBaseText)
    const sorted = [...chunks].sort((a, b) => a.baseStartLine - b.baseStartLine)

    const oursParts: string[] = []
    const resultParts: string[] = []
    const theirsParts: string[] = []
    let cursor = 0

    for (const chunk of sorted) {
        // Copy unmodified base lines before this chunk (identical in all three)
        const unchanged = baseLines.slice(cursor, chunk.baseStartLine)
        oursParts.push(...unchanged)
        resultParts.push(...unchanged)
        theirsParts.push(...unchanged)
        cursor = chunk.baseEndLine

        const resolvedLines = resolveChunkLines(chunk)

        // Pad this chunk to equal height
        const maxLines = Math.max(
            chunk.oursLines.length,
            resolvedLines.length,
            chunk.theirsLines.length
        )
        oursParts.push(...pad(chunk.oursLines, maxLines))
        resultParts.push(...pad(resolvedLines, maxLines))
        theirsParts.push(...pad(chunk.theirsLines, maxLines))
    }

    // Copy remaining base lines after last chunk
    const tail = baseLines.slice(cursor)
    oursParts.push(...tail)
    resultParts.push(...tail)
    theirsParts.push(...tail)

    return {
        ours: oursParts.join('\n'),
        result: resultParts.join('\n'),
        theirs: theirsParts.join('\n'),
    }
}
