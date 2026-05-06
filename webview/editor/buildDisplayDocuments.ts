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
    base: string
    theirs: string
}

/**
 * Build three display documents with identical line counts by padding
 * each conflict chunk to max(ours, base, theirs) height. Unchanged base
 * regions are copied identically to all three documents.
 */
export function buildDisplayDocuments(
    fullBaseText: string,
    chunks: ConflictChunk[]
): DisplayDocuments {
    const baseLines = splitLines(fullBaseText)
    const sorted = [...chunks].sort((a, b) => a.baseStartLine - b.baseStartLine)

    const oursParts: string[] = []
    const baseParts: string[] = []
    const theirsParts: string[] = []
    let cursor = 0

    for (const chunk of sorted) {
        // Copy unmodified base lines before this chunk (identical in all three)
        const unchanged = baseLines.slice(cursor, chunk.baseStartLine)
        oursParts.push(...unchanged)
        baseParts.push(...unchanged)
        theirsParts.push(...unchanged)
        cursor = chunk.baseEndLine

        // Pad this chunk to equal height
        const maxLines = Math.max(
            chunk.oursLines.length,
            chunk.baseLines.length,
            chunk.theirsLines.length
        )
        oursParts.push(...pad(chunk.oursLines, maxLines))
        baseParts.push(...pad(chunk.baseLines, maxLines))
        theirsParts.push(...pad(chunk.theirsLines, maxLines))
    }

    // Copy remaining base lines after last chunk
    const tail = baseLines.slice(cursor)
    oursParts.push(...tail)
    baseParts.push(...tail)
    theirsParts.push(...tail)

    return {
        ours: oursParts.join('\n'),
        base: baseParts.join('\n'),
        theirs: theirsParts.join('\n'),
    }
}
