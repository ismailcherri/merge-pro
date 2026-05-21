import type { ChunkLineMap, LineRange } from './buildDisplayDocuments'
import { computeInlineDiff, type DiffSpan } from './inlineDiff'

export interface InlineRange {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
}

export interface InlineDecoration {
    range: InlineRange
    options: { inlineClassName: string }
}

export interface PaneInlineDecorations {
    ours: InlineDecoration[]
    result: InlineDecoration[]
    theirs: InlineDecoration[]
}

export interface ChunkBaseRange {
    /** 1-indexed inclusive base line range. If end < start, treat as empty. */
    start: number
    end: number
}

export interface ComputeInput {
    ours: string
    result: string
    theirs: string
    baseText: string
    chunkMaps: ChunkLineMap[]
    chunkBaseRanges: ChunkBaseRange[]
}

function splitLines(text: string): string[] {
    const lines = text.replaceAll('\r\n', '\n').split('\n')
    if (lines.length > 0 && lines.at(-1) === '') lines.pop()
    return lines
}

function rangeLineCount(r: LineRange): number {
    if (r.end < r.start) return 0
    return r.end - r.start + 1
}

function spansToDecorations(
    spans: DiffSpan[],
    lineNumber: number
): InlineDecoration[] {
    return spans.map((s) => ({
        range: {
            startLineNumber: lineNumber,
            startColumn: s.start + 1,
            endLineNumber: lineNumber,
            endColumn: s.end + 1,
        },
        options: {
            inlineClassName:
                s.kind === 'added' ? 'mp-inline-added' : 'mp-inline-removed',
        },
    }))
}

export function computePaneInlineDecorations(
    input: ComputeInput
): PaneInlineDecorations {
    const oursLines = splitLines(input.ours)
    const resultLines = splitLines(input.result)
    const theirsLines = splitLines(input.theirs)
    const baseLines = splitLines(input.baseText)

    const ours: InlineDecoration[] = []
    const result: InlineDecoration[] = []
    const theirs: InlineDecoration[] = []

    for (let chunkIdx = 0; chunkIdx < input.chunkMaps.length; chunkIdx++) {
        const map = input.chunkMaps[chunkIdx]
        if (!map) continue
        const oursN = rangeLineCount(map.ours)
        const resultN = rangeLineCount(map.result)
        const theirsN = rangeLineCount(map.theirs)

        const oursResultPairs = Math.min(oursN, resultN)
        for (let k = 0; k < oursResultPairs; k++) {
            const oursLineNo = map.ours.start + k
            const resultLineNo = map.result.start + k
            const a = oursLines[oursLineNo - 1] ?? ''
            const b = resultLines[resultLineNo - 1] ?? ''
            const d = computeInlineDiff(a, b)
            ours.push(...spansToDecorations(d.left, oursLineNo))
        }

        const theirsResultPairs = Math.min(theirsN, resultN)
        for (let k = 0; k < theirsResultPairs; k++) {
            const theirsLineNo = map.theirs.start + k
            const resultLineNo = map.result.start + k
            const a = theirsLines[theirsLineNo - 1] ?? ''
            const b = resultLines[resultLineNo - 1] ?? ''
            const d = computeInlineDiff(a, b)
            theirs.push(...spansToDecorations(d.left, theirsLineNo))
        }

        const baseRange = input.chunkBaseRanges[chunkIdx]
        if (baseRange) {
            const baseN =
                baseRange.end < baseRange.start
                    ? 0
                    : baseRange.end - baseRange.start + 1
            const resultBasePairs = Math.min(resultN, baseN)
            for (let k = 0; k < resultBasePairs; k++) {
                const resultLineNo = map.result.start + k
                const baseLineNo = baseRange.start + k
                const a = baseLines[baseLineNo - 1] ?? ''
                const b = resultLines[resultLineNo - 1] ?? ''
                const d = computeInlineDiff(a, b)
                result.push(...spansToDecorations(d.right, resultLineNo))
            }
        }
    }

    return { ours, result, theirs }
}
