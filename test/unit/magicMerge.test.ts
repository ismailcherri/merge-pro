import { describe, expect, it } from 'vitest'
import { magicMerge } from '../../src/utils/magicMerge'

describe('magicMerge', () => {
    it('returns ours when both sides made the identical change', () => {
        const merged = magicMerge(['a', 'b', 'c'], ['a', 'X', 'c'], ['a', 'X', 'c'])
        expect(merged).toEqual(['a', 'X', 'c'])
    })

    it('returns theirs when ours equals base (only theirs changed)', () => {
        const merged = magicMerge(['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'X', 'c'])
        expect(merged).toEqual(['a', 'X', 'c'])
    })

    it('returns ours when theirs equals base (only ours changed)', () => {
        const merged = magicMerge(['a', 'b', 'c'], ['a', 'X', 'c'], ['a', 'b', 'c'])
        expect(merged).toEqual(['a', 'X', 'c'])
    })

    it('weaves disjoint single-line edits inside the same region', () => {
        // Both sides modify the same chunk, but touch different lines.
        const base = ['a', 'b', 'c', 'd', 'e']
        const ours = ['a', 'B', 'c', 'd', 'e'] // edits line 2
        const theirs = ['a', 'b', 'c', 'D', 'e'] // edits line 4
        expect(magicMerge(base, ours, theirs)).toEqual(['a', 'B', 'c', 'D', 'e'])
    })

    it('merges disjoint insertions at different anchors', () => {
        const base = ['a', 'b', 'c']
        const ours = ['a', 'X', 'b', 'c'] // inserts X before b
        const theirs = ['a', 'b', 'Y', 'c'] // inserts Y before c
        expect(magicMerge(base, ours, theirs)).toEqual(['a', 'X', 'b', 'Y', 'c'])
    })

    it('merges deletion + unrelated edit', () => {
        const base = ['a', 'b', 'c', 'd']
        const ours = ['a', 'c', 'd'] // deletes b
        const theirs = ['a', 'b', 'c', 'D'] // edits d
        expect(magicMerge(base, ours, theirs)).toEqual(['a', 'c', 'D'])
    })

    it('returns null when both sides edit the same line differently', () => {
        const base = ['a', 'b', 'c']
        const ours = ['a', 'X', 'c']
        const theirs = ['a', 'Y', 'c']
        expect(magicMerge(base, ours, theirs)).toBeNull()
    })

    it('returns null when both sides insert different lines at the same anchor', () => {
        // Pattern 3 — the conservative option (B). Ambiguous ordering.
        const base = ['a', 'b']
        const ours = ['a', 'X', 'b']
        const theirs = ['a', 'Y', 'b']
        expect(magicMerge(base, ours, theirs)).toBeNull()
    })

    it('accepts identical insertions at the same anchor (dedup)', () => {
        const base = ['a', 'b']
        const ours = ['a', 'X', 'b']
        const theirs = ['a', 'X', 'b']
        expect(magicMerge(base, ours, theirs)).toEqual(['a', 'X', 'b'])
    })

    it('returns null when ranges overlap with different replacements', () => {
        const base = ['a', 'b', 'c', 'd']
        const ours = ['a', 'X', 'Y', 'd'] // replaces b,c with X,Y
        const theirs = ['a', 'Z', 'd'] // replaces b,c with Z
        expect(magicMerge(base, ours, theirs)).toBeNull()
    })

    it('handles edits at the very start of the region', () => {
        const base = ['a', 'b', 'c']
        const ours = ['A', 'b', 'c']
        const theirs = ['a', 'b', 'C']
        expect(magicMerge(base, ours, theirs)).toEqual(['A', 'b', 'C'])
    })

    it('handles edits at the very end of the region', () => {
        const base = ['a', 'b']
        const ours = ['A', 'b']
        const theirs = ['a', 'b', 'C'] // append
        expect(magicMerge(base, ours, theirs)).toEqual(['A', 'b', 'C'])
    })

    it('handles empty base (both sides only added lines)', () => {
        // Both sides added the same lines at position 0 — identical
        // insertions dedup to one copy.
        expect(magicMerge([], ['a'], ['a'])).toEqual(['a'])
        // Different content at the same anchor → conflict.
        expect(magicMerge([], ['a'], ['b'])).toBeNull()
    })

    it('handles empty ours (full deletion vs unrelated edit)', () => {
        const base = ['a', 'b', 'c']
        const ours: string[] = []
        const theirs = ['a', 'B', 'c'] // edits middle
        // Ours deletes the whole region; theirs edits inside that range.
        // Ranges overlap → conflict.
        expect(magicMerge(base, ours, theirs)).toBeNull()
    })

    it('package-lock style: both sides add different dependencies', () => {
        // Common pattern the wand should catch.
        const base = ['"deps": {', '  "old": "1.0"', '}']
        const ours = ['"deps": {', '  "old": "1.0",', '  "ours-pkg": "2.0"', '}']
        const theirs = [
            '"deps": {',
            '  "old": "1.0",',
            '  "theirs-pkg": "3.0"',
            '}',
        ]
        // ours edits line 2 (adds comma) AND inserts a new line. theirs
        // makes the same line-2 edit (adds comma) AND inserts a different
        // line. The line-2 edit is identical between both sides and dedups;
        // the two new insertions are at the same anchor with different
        // content → conflict.
        expect(magicMerge(base, ours, theirs)).toBeNull()
    })
})
