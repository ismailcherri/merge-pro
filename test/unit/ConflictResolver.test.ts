import { describe, expect, it } from 'vitest'
import type { ConflictChunk } from '../../src/protocol'
import { resolveFile } from '../../src/utils/ConflictResolver'

const join = (...lines: string[]) => lines.join('\n')

function makeChunk(overrides: Partial<ConflictChunk>): ConflictChunk {
    return {
        type: 'conflict',
        oursLines: ['OURS'],
        theirsLines: ['THEIRS'],
        baseStartLine: 0,
        baseEndLine: 1,
        ...overrides,
    }
}

describe('resolveFile', () => {
    it('keeps base lines when chunk is unresolved (no resolvedWith)', () => {
        const base = join('a', 'b', 'c')
        const chunk = makeChunk({ baseStartLine: 1, baseEndLine: 2 }) // no resolvedWith
        expect(resolveFile(base, [chunk])).toBe(join('a', 'b', 'c'))
    })

    it('replaces base lines with ours when resolved with ours', () => {
        const base = join('a', 'b', 'c')
        const chunk = makeChunk({
            oursLines: ['OURS'],
            baseStartLine: 1,
            baseEndLine: 2,
            resolvedWith: 'ours',
        })
        expect(resolveFile(base, [chunk])).toBe(join('a', 'OURS', 'c'))
    })

    it('replaces base lines with theirs when resolved with theirs', () => {
        const base = join('a', 'b', 'c')
        const chunk = makeChunk({
            theirsLines: ['THEIRS'],
            baseStartLine: 1,
            baseEndLine: 2,
            resolvedWith: 'theirs',
        })
        expect(resolveFile(base, [chunk])).toBe(join('a', 'THEIRS', 'c'))
    })

    it('uses manualLines when resolvedWith is manual', () => {
        const base = join('a', 'b', 'c')
        const chunk = makeChunk({
            baseStartLine: 1,
            baseEndLine: 2,
            resolvedWith: 'manual',
            manualLines: ['MANUAL'],
        })
        expect(resolveFile(base, [chunk])).toBe(join('a', 'MANUAL', 'c'))
    })

    it('handles insertion (zero-length base range)', () => {
        const base = join('a', 'c')
        const chunk = makeChunk({
            oursLines: ['b'],
            baseStartLine: 1,
            baseEndLine: 1,
            resolvedWith: 'ours',
        })
        expect(resolveFile(base, [chunk])).toBe(join('a', 'b', 'c'))
    })

    it('handles multiple chunks', () => {
        const base = join('a', 'b', 'c', 'd')
        const chunks = [
            makeChunk({
                oursLines: ['B'],
                baseStartLine: 1,
                baseEndLine: 2,
                resolvedWith: 'ours',
            }),
            makeChunk({
                theirsLines: ['D'],
                baseStartLine: 3,
                baseEndLine: 4,
                resolvedWith: 'theirs',
            }),
        ]
        expect(resolveFile(base, chunks)).toBe(join('a', 'B', 'c', 'D'))
    })

    it('returns base unchanged when no chunks', () => {
        const base = join('a', 'b', 'c')
        expect(resolveFile(base, [])).toBe(base)
    })
})
