import { describe, expect, it } from 'vitest'
import type { ChunkLineMap } from '../../../webview/editor/buildDisplayDocuments'
import { mapLine } from '../../../webview/editor/lineMapping'

const m = (
    oursStart: number,
    oursEnd: number,
    resStart: number,
    resEnd: number,
    theirsStart: number,
    theirsEnd: number
): ChunkLineMap => ({
    ours: { start: oursStart, end: oursEnd },
    result: { start: resStart, end: resEnd },
    theirs: { start: theirsStart, end: theirsEnd },
})

describe('mapLine', () => {
    it('returns the same line when source and destination panes are the same', () => {
        expect(mapLine('ours', 'ours', 42, [])).toBe(42)
    })

    it('maps 1:1 when there are no chunks', () => {
        expect(mapLine('ours', 'theirs', 7, [])).toBe(7)
    })

    it('maps a line before the first chunk by translating cursors equally', () => {
        // Chunk starts at line 5 in all panes.
        const chunks = [m(5, 6, 5, 6, 5, 6)]
        expect(mapLine('ours', 'result', 3, chunks)).toBe(3)
    })

    it('maps a line inside a chunk proportionally to the destination range', () => {
        // Source range ours 5..8 (4 lines), dest theirs 5..6 (2 lines).
        const chunks = [m(5, 8, 5, 8, 5, 6)]
        expect(mapLine('ours', 'theirs', 5, chunks)).toBe(5)
        // Last source line should clamp to the last destination line.
        expect(mapLine('ours', 'theirs', 8, chunks)).toBe(6)
    })

    it('maps a line inside an empty destination range to the destination start', () => {
        // ours has 2 lines but theirs is an empty insertion (end < start).
        const chunks = [m(5, 6, 5, 6, 5, 4)]
        expect(mapLine('ours', 'theirs', 5, chunks)).toBe(5)
    })

    it('maps a line after the last chunk by extrapolating from the dst cursor', () => {
        // Ours chunk is 1 line at row 5; theirs chunk is 2 lines at 5..6.
        // After-chunk cursors: src=6, dst=7. Source line 7 is 1 past the chunk
        // → dst 7 + (7-6) = 8.
        const chunks = [m(5, 5, 5, 5, 5, 6)]
        expect(mapLine('ours', 'theirs', 7, chunks)).toBe(8)
    })
})
