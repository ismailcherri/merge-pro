import { describe, expect, it } from 'vitest'
import type { ConflictChunk } from '../../src/protocol'
import { resolveFile } from '../../src/utils/ConflictResolver'

const join = (...lines: string[]) => lines.join('\n')

function makeChunk(overrides: Partial<ConflictChunk>): ConflictChunk {
    return {
        type: 'conflict',
        oursLines: ['OURS'],
        baseLines: ['b'],
        theirsLines: ['THEIRS'],
        baseStartLine: 0,
        baseEndLine: 1,
        ...overrides,
    }
}

describe('resolveFile', () => {
    it('keeps base lines when chunk is fully undecided', () => {
        const base = join('a', 'b', 'c')
        const chunk = makeChunk({
            baseLines: ['b'],
            baseStartLine: 1,
            baseEndLine: 2,
        })
        expect(resolveFile(base, [chunk])).toBe(join('a', 'b', 'c'))
    })

    it('uses ours when ours accepted and theirs discarded', () => {
        const base = join('a', 'b', 'c')
        const chunk = makeChunk({
            oursLines: ['OURS'],
            baseLines: ['b'],
            baseStartLine: 1,
            baseEndLine: 2,
            oursDecision: 'accept',
            theirsDecision: 'discard',
        })
        expect(resolveFile(base, [chunk])).toBe(join('a', 'OURS', 'c'))
    })

    it('uses theirs when ours discarded and theirs accepted', () => {
        const base = join('a', 'b', 'c')
        const chunk = makeChunk({
            theirsLines: ['THEIRS'],
            baseLines: ['b'],
            baseStartLine: 1,
            baseEndLine: 2,
            oursDecision: 'discard',
            theirsDecision: 'accept',
        })
        expect(resolveFile(base, [chunk])).toBe(join('a', 'THEIRS', 'c'))
    })

    it('concatenates ours then theirs when both accepted', () => {
        const base = join('a', 'b', 'c')
        const chunk = makeChunk({
            oursLines: ['OURS'],
            theirsLines: ['THEIRS'],
            baseLines: ['b'],
            baseStartLine: 1,
            baseEndLine: 2,
            oursDecision: 'accept',
            theirsDecision: 'accept',
        })
        expect(resolveFile(base, [chunk])).toBe(
            join('a', 'OURS', 'THEIRS', 'c')
        )
    })

    it('keeps base when both sides discarded', () => {
        const base = join('a', 'b', 'c')
        const chunk = makeChunk({
            baseLines: ['b'],
            baseStartLine: 1,
            baseEndLine: 2,
            oursDecision: 'discard',
            theirsDecision: 'discard',
        })
        expect(resolveFile(base, [chunk])).toBe(join('a', 'b', 'c'))
    })

    it('uses manualLines when set, regardless of per-side decisions', () => {
        const base = join('a', 'b', 'c')
        const chunk = makeChunk({
            baseLines: ['b'],
            baseStartLine: 1,
            baseEndLine: 2,
            oursDecision: 'accept',
            theirsDecision: 'accept',
            manualLines: ['MANUAL'],
        })
        expect(resolveFile(base, [chunk])).toBe(join('a', 'MANUAL', 'c'))
    })

    it('handles insertion (zero-length base range)', () => {
        const base = join('a', 'c')
        const chunk = makeChunk({
            oursLines: ['b'],
            baseLines: [],
            baseStartLine: 1,
            baseEndLine: 1,
            oursDecision: 'accept',
            theirsDecision: 'discard',
        })
        expect(resolveFile(base, [chunk])).toBe(join('a', 'b', 'c'))
    })

    it('handles multiple chunks', () => {
        const base = join('a', 'b', 'c', 'd')
        const chunks = [
            makeChunk({
                oursLines: ['B'],
                baseLines: ['b'],
                baseStartLine: 1,
                baseEndLine: 2,
                oursDecision: 'accept',
                theirsDecision: 'discard',
            }),
            makeChunk({
                theirsLines: ['D'],
                baseLines: ['d'],
                baseStartLine: 3,
                baseEndLine: 4,
                oursDecision: 'discard',
                theirsDecision: 'accept',
            }),
        ]
        expect(resolveFile(base, chunks)).toBe(join('a', 'B', 'c', 'D'))
    })

    it('returns base unchanged when no chunks', () => {
        const base = join('a', 'b', 'c')
        expect(resolveFile(base, [])).toBe(base)
    })
})
