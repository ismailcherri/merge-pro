import { resolvedChunkLines, type ConflictChunk } from '../protocol'

function splitLines(text: string): string[] {
    const lines = text.replace(/\r\n/g, '\n').split('\n')
    if (lines[lines.length - 1] === '') lines.pop()
    return lines
}

/**
 * Applies chunk resolution decisions to baseText, returning the resolved file content.
 * Fully-undecided chunks leave the base content unchanged.
 */
export function resolveFile(baseText: string, chunks: ConflictChunk[]): string {
    const baseLines = splitLines(baseText)
    const sorted = [...chunks].sort((a, b) => a.baseStartLine - b.baseStartLine)

    const output: string[] = []
    let baseCursor = 0

    for (const chunk of sorted) {
        output.push(...baseLines.slice(baseCursor, chunk.baseStartLine))
        baseCursor = chunk.baseEndLine
        output.push(...resolvedChunkLines(chunk))
    }

    output.push(...baseLines.slice(baseCursor))
    return output.join('\n')
}
