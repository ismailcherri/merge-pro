import { describe, expect, it } from 'vitest'
import {
    isChunkResolved,
    resolvedChunkLines,
    singleChangedSide,
    type ConflictChunk,
} from '../../src/protocol'
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

describe('one-sided non-conflicting chunks', () => {
    const oursOnly: ConflictChunk = {
        type: 'non-conflicting',
        oursLines: ['OURS'],
        baseLines: ['b'],
        theirsLines: ['b'],
        baseStartLine: 1,
        baseEndLine: 2,
        winner: 'ours',
    }
    const theirsOnly: ConflictChunk = {
        type: 'non-conflicting',
        oursLines: ['b'],
        baseLines: ['b'],
        theirsLines: ['THEIRS'],
        baseStartLine: 1,
        baseEndLine: 2,
        winner: 'theirs',
    }

    it('singleChangedSide identifies ours-only and theirs-only', () => {
        expect(singleChangedSide(oursOnly)).toBe('ours')
        expect(singleChangedSide(theirsOnly)).toBe('theirs')
    })

    it('ours-only chunk is resolved by oursDecision alone', () => {
        expect(isChunkResolved(oursOnly)).toBe(false)
        expect(isChunkResolved({ ...oursOnly, oursDecision: 'accept' })).toBe(
            true
        )
        expect(isChunkResolved({ ...oursOnly, oursDecision: 'discard' })).toBe(
            true
        )
        // theirsDecision alone does not resolve an ours-only chunk
        expect(isChunkResolved({ ...oursOnly, theirsDecision: 'accept' })).toBe(
            false
        )
    })

    it('theirs-only chunk is resolved by theirsDecision alone', () => {
        expect(isChunkResolved(theirsOnly)).toBe(false)
        expect(
            isChunkResolved({ ...theirsOnly, theirsDecision: 'accept' })
        ).toBe(true)
        expect(isChunkResolved({ ...theirsOnly, oursDecision: 'accept' })).toBe(
            false
        )
    })

    it('accept on the changed side yields its lines; discard yields base', () => {
        expect(
            resolvedChunkLines({ ...oursOnly, oursDecision: 'accept' })
        ).toEqual(['OURS'])
        expect(
            resolvedChunkLines({ ...oursOnly, oursDecision: 'discard' })
        ).toEqual(['b'])
        expect(
            resolvedChunkLines({ ...theirsOnly, theirsDecision: 'accept' })
        ).toEqual(['THEIRS'])
        expect(
            resolvedChunkLines({ ...theirsOnly, theirsDecision: 'discard' })
        ).toEqual(['b'])
    })

    it('does not duplicate content when both decisions are accept on a one-sided chunk', () => {
        // Previously "accept ours + accept theirs" concatenated, producing
        // duplicate base content for a one-sided change. Now the unchanged
        // side is ignored.
        const base = join('a', 'b', 'c')
        const chunk: ConflictChunk = {
            ...oursOnly,
            oursDecision: 'accept',
            theirsDecision: 'accept',
        }
        expect(resolveFile(base, [chunk])).toBe(join('a', 'OURS', 'c'))
    })
})
