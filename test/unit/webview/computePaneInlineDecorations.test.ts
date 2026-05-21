import { describe, expect, it } from 'vitest'
import { computePaneInlineDecorations } from '../../../webview/editor/computePaneInlineDecorations'

describe('computePaneInlineDecorations', () => {
    it('returns empty arrays when there are no chunks', () => {
        const r = computePaneInlineDecorations({
            ours: '',
            result: '',
            theirs: '',
            baseText: '',
            chunkMaps: [],
            chunkBaseRanges: [],
        })
        expect(r.ours).toEqual([])
        expect(r.result).toEqual([])
        expect(r.theirs).toEqual([])
    })
})

describe('computePaneInlineDecorations — side panes vs. Result', () => {
    it('highlights character changes in the ours pane against Result', () => {
        const chunkMaps = [
            {
                ours: { start: 1, end: 1 },
                result: { start: 1, end: 1 },
                theirs: { start: 1, end: 1 },
            },
        ]
        const r = computePaneInlineDecorations({
            ours: '"next": "16.2.5",',
            result: '"next": "15.1.7",',
            theirs: '"next": "15.1.7",',
            baseText: '"next": "15.1.7",',
            chunkMaps,
            chunkBaseRanges: [{ start: 1, end: 1 }],
        })
        // Per inlineDiff semantic cleanup: "6.2.5" -> "5.1.7" spans cols 11..16 (1-based).
        expect(r.ours).toEqual([
            {
                range: {
                    startLineNumber: 1,
                    startColumn: 11,
                    endLineNumber: 1,
                    endColumn: 16,
                },
                options: { inlineClassName: 'mp-inline-removed' },
            },
        ])
        expect(r.theirs).toEqual([])
    })

    it('highlights changes in theirs pane against Result', () => {
        const chunkMaps = [
            {
                ours: { start: 1, end: 1 },
                result: { start: 1, end: 1 },
                theirs: { start: 1, end: 1 },
            },
        ]
        const r = computePaneInlineDecorations({
            ours: 'foo',
            result: 'foo',
            theirs: 'foobar',
            baseText: 'foo',
            chunkMaps,
            chunkBaseRanges: [{ start: 1, end: 1 }],
        })
        expect(r.theirs).toEqual([
            {
                range: {
                    startLineNumber: 1,
                    startColumn: 4,
                    endLineNumber: 1,
                    endColumn: 7,
                },
                options: { inlineClassName: 'mp-inline-removed' },
            },
        ])
    })

    it('emits no inline decorations when a side has no counterpart line in Result', () => {
        const chunkMaps = [
            {
                ours: { start: 1, end: 2 },
                result: { start: 1, end: 1 },
                theirs: { start: 1, end: 1 },
            },
        ]
        const r = computePaneInlineDecorations({
            ours: 'same\nextra',
            result: 'same',
            theirs: 'same',
            baseText: 'same',
            chunkMaps,
            chunkBaseRanges: [{ start: 1, end: 1 }],
        })
        expect(r.ours).toEqual([])
    })
})

describe('computePaneInlineDecorations — Result vs. base', () => {
    it('highlights changes in Result relative to base', () => {
        const chunkMaps = [
            {
                ours: { start: 1, end: 1 },
                result: { start: 1, end: 1 },
                theirs: { start: 1, end: 1 },
            },
        ]
        const r = computePaneInlineDecorations({
            ours: '"v": "1.0.0",',
            result: '"v": "1.0.1",',
            theirs: '"v": "1.0.1",',
            baseText: '"v": "1.0.0",',
            chunkMaps,
            chunkBaseRanges: [{ start: 1, end: 1 }],
        })
        // Equal prefix `"v": "1.0.` (10 chars); the last `0` -> `1` is at index 10.
        expect(r.result).toEqual([
            {
                range: {
                    startLineNumber: 1,
                    startColumn: 11,
                    endLineNumber: 1,
                    endColumn: 12,
                },
                options: { inlineClassName: 'mp-inline-added' },
            },
        ])
    })

    it('emits no Result decorations when Result matches base for the chunk', () => {
        const chunkMaps = [
            {
                ours: { start: 1, end: 1 },
                result: { start: 1, end: 1 },
                theirs: { start: 1, end: 1 },
            },
        ]
        const r = computePaneInlineDecorations({
            ours: 'same',
            result: 'same',
            theirs: 'changed',
            baseText: 'same',
            chunkMaps,
            chunkBaseRanges: [{ start: 1, end: 1 }],
        })
        expect(r.result).toEqual([])
    })
})
