import DiffMatchPatch from 'diff-match-patch'

const LONG_LINE_THRESHOLD = 1000

const dmp = new DiffMatchPatch.diff_match_patch()
dmp.Diff_Timeout = 0.1

export interface DiffSpan {
    start: number
    end: number
    kind: 'added' | 'removed'
}

export interface InlineDiffResult {
    left: DiffSpan[]
    right: DiffSpan[]
}

export function computeInlineDiff(a: string, b: string): InlineDiffResult {
    if (a === b) return { left: [], right: [] }

    if (a.length > LONG_LINE_THRESHOLD || b.length > LONG_LINE_THRESHOLD) {
        return {
            left:
                a.length > 0
                    ? [{ start: 0, end: a.length, kind: 'removed' }]
                    : [],
            right:
                b.length > 0
                    ? [{ start: 0, end: b.length, kind: 'added' }]
                    : [],
        }
    }

    const diffs = dmp.diff_main(a, b)
    dmp.diff_cleanupSemantic(diffs)

    const left: DiffSpan[] = []
    const right: DiffSpan[] = []
    let leftPos = 0
    let rightPos = 0

    for (const [op, text] of diffs) {
        if (op === 0) {
            leftPos += text.length
            rightPos += text.length
        } else if (op === -1) {
            left.push({
                start: leftPos,
                end: leftPos + text.length,
                kind: 'removed',
            })
            leftPos += text.length
        } else if (op === 1) {
            right.push({
                start: rightPos,
                end: rightPos + text.length,
                kind: 'added',
            })
            rightPos += text.length
        }
    }

    return { left, right }
}
