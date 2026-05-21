import { describe, expect, it, vi } from 'vitest'

// ThreePaneEditor's module evaluates `monaco.Range` at import time when its
// helpers run. We only need the Range constructor for emptyRangeDecoration —
// stub monaco-editor to avoid booting the real editor under jsdom.
vi.mock('monaco-editor', () => {
    class Range {
        constructor(
            public startLineNumber: number,
            public startColumn: number,
            public endLineNumber: number,
            public endColumn: number
        ) {}
    }
    return {
        Range,
        editor: { EditorOption: { lineHeight: 1 } },
    }
})

import type { ConflictChunk } from '../../../src/protocol'
import {
    classForOurs,
    classForTheirs,
    classNameFor,
    emptyRangeDecoration,
    emptyRangeVariant,
} from '../../../webview/editor/ThreePaneEditor'

function conflict(overrides: Partial<ConflictChunk> = {}): ConflictChunk {
    return {
        type: 'conflict',
        oursLines: ['a'],
        baseLines: ['b'],
        theirsLines: ['c'],
        baseStartLine: 0,
        baseEndLine: 1,
        ...overrides,
    } as ConflictChunk
}

function nonConflicting(): ConflictChunk {
    return {
        type: 'non-conflicting',
        oursLines: ['a'],
        baseLines: ['b'],
        theirsLines: ['b'],
        baseStartLine: 0,
        baseEndLine: 1,
        winner: 'ours',
    }
}

describe('emptyRangeVariant', () => {
    it('returns "nonconflict" for non-conflicting chunks', () => {
        expect(emptyRangeVariant(nonConflicting())).toBe('nonconflict')
    })

    it('returns "conflict" for an unresolved conflict with no per-side decisions', () => {
        expect(emptyRangeVariant(conflict())).toBe('conflict')
    })

    it('returns "partial" for a conflict that has any per-side decision', () => {
        expect(emptyRangeVariant(conflict({ oursDecision: 'accept' }))).toBe(
            'partial'
        )
        expect(emptyRangeVariant(conflict({ theirsDecision: 'discard' }))).toBe(
            'partial'
        )
    })
})

describe('classForOurs / classForTheirs', () => {
    it.each([
        [conflict(), false, 'merge-ours-conflict'],
        [nonConflicting(), false, 'merge-ours-nonconflicting'],
        [conflict(), true, 'merge-ours-resolved'],
    ] as const)('classForOurs(%j, %s) → %s', (chunk, isResolved, expected) => {
        expect(classForOurs(chunk, isResolved)).toBe(expected)
    })

    it.each([
        [conflict(), false, 'merge-theirs-conflict'],
        [nonConflicting(), false, 'merge-theirs-nonconflicting'],
        [conflict(), true, 'merge-theirs-resolved'],
    ] as const)(
        'classForTheirs(%j, %s) → %s',
        (chunk, isResolved, expected) => {
            expect(classForTheirs(chunk, isResolved)).toBe(expected)
        }
    )
})

describe('classNameFor', () => {
    it('delegates to classForOurs / classForTheirs for the side panes', () => {
        expect(classNameFor('ours', conflict(), false)).toBe(
            'merge-ours-conflict'
        )
        expect(classNameFor('theirs', conflict(), false)).toBe(
            'merge-theirs-conflict'
        )
    })

    it('returns the result-resolved class for the result pane when resolved', () => {
        expect(classNameFor('result', conflict(), true)).toBe(
            'merge-result-resolved'
        )
    })

    it('returns the result-unresolved class for the result pane when not resolved', () => {
        expect(classNameFor('result', conflict(), false)).toBe(
            'merge-result-unresolved'
        )
    })
})

describe('emptyRangeDecoration', () => {
    it('places the marker on the line above when range.start > 1', () => {
        const dec = emptyRangeDecoration(conflict(), { start: 5, end: 4 })
        const r = dec.range as unknown as {
            startLineNumber: number
            endLineNumber: number
        }
        expect(r.startLineNumber).toBe(4)
        expect(r.endLineNumber).toBe(4)
        const opts = dec.options as unknown as { className: string }
        expect(opts.className).toBe('merge-empty-conflict-bottom')
    })

    it('places a top-anchored marker on line 1 when the chunk is at the top', () => {
        const dec = emptyRangeDecoration(conflict(), { start: 1, end: 0 })
        const r = dec.range as unknown as {
            startLineNumber: number
            endLineNumber: number
        }
        expect(r.startLineNumber).toBe(1)
        expect(r.endLineNumber).toBe(1)
        const opts = dec.options as unknown as { className: string }
        expect(opts.className).toBe('merge-empty-conflict-top')
    })

    it('uses the partial variant for conflicts with a per-side decision', () => {
        const dec = emptyRangeDecoration(conflict({ oursDecision: 'accept' }), {
            start: 5,
            end: 4,
        })
        const opts = dec.options as unknown as { className: string }
        expect(opts.className).toBe('merge-empty-partial-bottom')
    })
})
