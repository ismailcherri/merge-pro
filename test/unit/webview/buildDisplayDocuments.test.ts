import { describe, expect, it } from 'vitest'
import type { ConflictChunk } from '../../../src/protocol'
import { buildDisplayDocuments } from '../../../webview/editor/buildDisplayDocuments'

describe('buildDisplayDocuments', () => {
    it('returns the original text for all three panes when there are no chunks', () => {
        const text = 'a\nb\nc\n'
        const { ours, result, theirs, chunkMaps } = buildDisplayDocuments(
            text,
            text,
            text,
            []
        )
        expect(ours).toBe('a\nb\nc')
        expect(result).toBe('a\nb\nc')
        expect(theirs).toBe('a\nb\nc')
        expect(chunkMaps).toEqual([])
    })

    it('emits per-pane line ranges for a simple non-conflicting chunk', () => {
        const chunk: ConflictChunk = {
            type: 'non-conflicting',
            oursLines: ['changed'],
            baseLines: ['orig'],
            theirsLines: ['orig'],
            baseStartLine: 1,
            baseEndLine: 2,
            winner: 'ours',
        }
        const { chunkMaps } = buildDisplayDocuments(
            'a\nchanged\nc\n',
            'a\norig\nc\n',
            'a\norig\nc\n',
            [chunk]
        )
        expect(chunkMaps).toHaveLength(1)
        expect(chunkMaps[0].ours).toEqual({ start: 2, end: 2 })
        expect(chunkMaps[0].result).toEqual({ start: 2, end: 2 })
        expect(chunkMaps[0].theirs).toEqual({ start: 2, end: 2 })
    })

    it('uses manualLines for the result pane when the chunk has a manual resolution', () => {
        const chunk: ConflictChunk = {
            type: 'conflict',
            oursLines: ['ours'],
            baseLines: ['base'],
            theirsLines: ['theirs'],
            baseStartLine: 0,
            baseEndLine: 1,
            manualLines: ['merged1', 'merged2'],
        }
        const { result, chunkMaps } = buildDisplayDocuments(
            'ours\n',
            'base\n',
            'theirs\n',
            [chunk]
        )
        expect(result).toBe('merged1\nmerged2')
        expect(chunkMaps[0].result).toEqual({ start: 1, end: 2 })
    })

    it('preserves chunk-input order in chunkMaps even when chunks are not pre-sorted', () => {
        const c1: ConflictChunk = {
            type: 'non-conflicting',
            oursLines: ['B-our'],
            baseLines: ['B'],
            theirsLines: ['B'],
            baseStartLine: 3,
            baseEndLine: 4,
            winner: 'ours',
        }
        const c0: ConflictChunk = {
            type: 'non-conflicting',
            oursLines: ['A-our'],
            baseLines: ['A'],
            theirsLines: ['A'],
            baseStartLine: 1,
            baseEndLine: 2,
            winner: 'ours',
        }
        // Pass in non-sorted order — maps should still align by input index.
        const { chunkMaps } = buildDisplayDocuments(
            'header\nA-our\nfill\nB-our\nfooter\n',
            'header\nA\nfill\nB\nfooter\n',
            'header\nA\nfill\nB\nfooter\n',
            [c1, c0]
        )
        // c1 is index 0 in input; c0 is index 1. c0 comes earlier in baseLines.
        expect(chunkMaps[0]).toBeDefined() // c1's map slot
        expect(chunkMaps[1]).toBeDefined() // c0's map slot
        expect(chunkMaps[1].result.start).toBeLessThan(
            chunkMaps[0].result.start
        )
    })
})
