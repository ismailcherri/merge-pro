import { describe, expect, it } from 'vitest'
import { computeInlineDiff } from '../../webview/editor/inlineDiff'

describe('computeInlineDiff', () => {
    it('returns empty spans when inputs are identical', () => {
        const r = computeInlineDiff('hello world', 'hello world')
        expect(r.left).toEqual([])
        expect(r.right).toEqual([])
    })
})

describe('computeInlineDiff — character changes', () => {
    it('highlights single-character substitution (version bump)', () => {
        // "^2.1.4", -> "^2.1.6", : char at index 6 ('4' vs '6').
        const r = computeInlineDiff('"^2.1.4",', '"^2.1.6",')
        expect(r.left).toEqual([{ start: 6, end: 7, kind: 'removed' }])
        expect(r.right).toEqual([{ start: 6, end: 7, kind: 'added' }])
    })

    it('highlights multi-character substitution', () => {
        // Semantic cleanup collapses to a 5-char run "6.2.5" -> "5.1.7".
        const r = computeInlineDiff('"next": "16.2.5",', '"next": "15.1.7",')
        expect(r.left).toEqual([{ start: 10, end: 15, kind: 'removed' }])
        expect(r.right).toEqual([{ start: 10, end: 15, kind: 'added' }])
    })

    it('highlights pure insertion (right longer than left)', () => {
        const r = computeInlineDiff('foo', 'foobar')
        expect(r.left).toEqual([])
        expect(r.right).toEqual([{ start: 3, end: 6, kind: 'added' }])
    })

    it('highlights pure deletion (left longer than right)', () => {
        const r = computeInlineDiff('foobar', 'foo')
        expect(r.left).toEqual([{ start: 3, end: 6, kind: 'removed' }])
        expect(r.right).toEqual([])
    })

    it('handles lines longer than 1000 chars with whole-line spans', () => {
        const a = 'a'.repeat(1500)
        const b = 'b'.repeat(1500)
        const r = computeInlineDiff(a, b)
        expect(r.left).toEqual([{ start: 0, end: 1500, kind: 'removed' }])
        expect(r.right).toEqual([{ start: 0, end: 1500, kind: 'added' }])
    })

    it('returns no spans for identical long lines', () => {
        const s = 'x'.repeat(2000)
        const r = computeInlineDiff(s, s)
        expect(r.left).toEqual([])
        expect(r.right).toEqual([])
    })
})
