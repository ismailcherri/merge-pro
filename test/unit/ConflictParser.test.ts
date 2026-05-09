import { describe, expect, it } from 'vitest'
import { parse } from '../../src/parsers/ConflictParser'

const join = (...lines: string[]) => lines.join('\n')

describe('ConflictParser.parse', () => {
    it('returns empty array when all three versions are identical', () => {
        const text = join('line1', 'line2', 'line3')
        expect(parse(text, text, text)).toEqual([])
    })

    it('detects a non-conflicting change from ours only', () => {
        const base = join('a', 'b', 'c')
        const ours = join('a', 'CHANGED', 'c')
        const theirs = join('a', 'b', 'c')

        const chunks = parse(ours, base, theirs)
        expect(chunks).toHaveLength(1)
        expect(chunks[0].type).toBe('non-conflicting')
        expect(chunks[0].oursLines).toEqual(['CHANGED'])
        expect(chunks[0].baseLines).toEqual(['b'])
        expect(chunks[0].theirsLines).toEqual(['b'])
        expect(chunks[0].baseStartLine).toBe(1)
        expect(chunks[0].baseEndLine).toBe(2)
        expect(chunks[0].oursDecision).toBeUndefined()
        expect(chunks[0].theirsDecision).toBeUndefined()
    })

    it('detects a non-conflicting change from theirs only', () => {
        const base = join('a', 'b', 'c')
        const ours = join('a', 'b', 'c')
        const theirs = join('a', 'THEIRS', 'c')

        const chunks = parse(ours, base, theirs)
        expect(chunks).toHaveLength(1)
        expect(chunks[0].type).toBe('non-conflicting')
        expect(chunks[0].oursLines).toEqual(['b'])
        expect(chunks[0].theirsLines).toEqual(['THEIRS'])
    })

    it('detects a true conflict when both sides change the same line', () => {
        const base = join('a', 'b', 'c')
        const ours = join('a', 'OURS', 'c')
        const theirs = join('a', 'THEIRS', 'c')

        const chunks = parse(ours, base, theirs)
        expect(chunks).toHaveLength(1)
        expect(chunks[0].type).toBe('conflict')
        expect(chunks[0].oursLines).toEqual(['OURS'])
        expect(chunks[0].baseLines).toEqual(['b'])
        expect(chunks[0].theirsLines).toEqual(['THEIRS'])
        expect(chunks[0].baseStartLine).toBe(1)
        expect(chunks[0].baseEndLine).toBe(2)
    })

    it('handles both a conflict and a non-conflicting change in the same file', () => {
        const base = join('a', 'b', 'c', 'd')
        const ours = join('a', 'OURS', 'c', 'd')
        const theirs = join('a', 'THEIRS', 'c', 'THEIRS_D')

        const chunks = parse(ours, base, theirs)
        // line b: conflict (both changed)
        // line d: non-conflicting (only theirs)
        expect(chunks).toHaveLength(2)
        const conflict = chunks.find((c) => c.type === 'conflict')!
        const nonConflict = chunks.find((c) => c.type === 'non-conflicting')!
        expect(conflict.oursLines).toEqual(['OURS'])
        expect(conflict.theirsLines).toEqual(['THEIRS'])
        expect(nonConflict.theirsLines).toEqual(['THEIRS_D'])
    })

    it('handles ours adding lines (insertion)', () => {
        const base = join('a', 'c')
        const ours = join('a', 'NEW1', 'NEW2', 'c')
        const theirs = join('a', 'c')

        const chunks = parse(ours, base, theirs)
        expect(chunks).toHaveLength(1)
        expect(chunks[0].type).toBe('non-conflicting')
        expect(chunks[0].oursLines).toEqual(['NEW1', 'NEW2'])
        expect(chunks[0].theirsLines).toEqual([])
        expect(chunks[0].baseStartLine).toBe(1)
        expect(chunks[0].baseEndLine).toBe(1) // pure insertion at base line 1
    })

    it('handles Windows line endings (CRLF)', () => {
        const base = 'a\r\nb\r\nc'
        const ours = 'a\r\nCHANGED\r\nc'
        const theirs = 'a\r\nb\r\nc'

        const chunks = parse(ours, base, theirs)
        expect(chunks).toHaveLength(1)
        expect(chunks[0].type).toBe('non-conflicting')
    })

    it('returns empty array for empty files', () => {
        expect(parse('', '', '')).toEqual([])
    })

    it('treats identical changes on both sides as non-conflicting', () => {
        const base = join('a', 'b', 'c')
        const both = join('a', 'NEW', 'c')
        const chunks = parse(both, base, both)
        expect(chunks).toHaveLength(1)
        expect(chunks[0].type).toBe('non-conflicting')
        expect(chunks[0].oursLines).toEqual(['NEW'])
        expect(chunks[0].theirsLines).toEqual(['NEW'])
    })

    it('returns no conflict when both sides delete all content', () => {
        const base = join('a', 'b', 'c')
        const chunks = parse('', base, '')
        expect(chunks).toHaveLength(1)
        expect(chunks[0].type).toBe('non-conflicting')
        expect(chunks[0].oursLines).toEqual([])
        expect(chunks[0].theirsLines).toEqual([])
    })

    it('handles trailing CRLF without spurious chunks', () => {
        // All three versions identical except trailing CRLF — should produce no chunks
        const text = 'a\r\nb\r\nc\r\n'
        expect(parse(text, text, text)).toEqual([])
    })

    it('pads chunk lines with unchanged base when one sides hunk is narrower than the chunk range', () => {
        // Conflict where theirs replaces base[0..3) but ours only changes
        // base[1..2). The chunk's base range is the union [0..3); ours's
        // contribution must include the unchanged base[0..1) and base[2..3)
        // so the chunk content actually spans the full range.
        const base = join('a', 'b', 'c')
        const ours = join('a', 'OURS', 'c')
        const theirs = join('X', 'Y', 'Z')

        const chunks = parse(ours, base, theirs)
        expect(chunks).toHaveLength(1)
        const c = chunks[0]
        expect(c.type).toBe('conflict')
        expect(c.baseStartLine).toBe(0)
        expect(c.baseEndLine).toBe(3)
        expect(c.oursLines).toEqual(['a', 'OURS', 'c'])
        expect(c.theirsLines).toEqual(['X', 'Y', 'Z'])
        expect(c.baseLines).toEqual(['a', 'b', 'c'])
    })

    it('preserves all ours content when ours-only insertion is coalesced with a wider conflict', () => {
        // Mirrors a JSON insertion: ours adds a NEW block before an existing
        // block whose body is also modified, while theirs replaces the whole
        // existing block. The diff library reports two ours hunks (insert,
        // then a small replace) plus one wide theirs hunk. Without padding,
        // the coalesced chunk drops the unchanged structural lines that ours
        // shares with base, and the editor's display ends up duplicating
        // lines past the chunk.
        const base = join(
            'pre',
            'BLOCK_HEADER',
            'old_version',
            'common_line',
            'post'
        )
        const ours = join(
            'pre',
            'NEW_HEADER',
            'NEW_BODY',
            'BLOCK_HEADER',
            'new_version',
            'common_line',
            'post'
        )
        const theirs = join('pre', 'REPLACED_A', 'REPLACED_B', 'post')

        const chunks = parse(ours, base, theirs)
        expect(chunks).toHaveLength(1)
        const c = chunks[0]
        // Coalesced chunk should fully describe ours's content for the base
        // range so cursor tracking stays consistent across the chunk.
        expect(c.oursLines).toEqual([
            'NEW_HEADER',
            'NEW_BODY',
            'BLOCK_HEADER',
            'new_version',
            'common_line',
        ])
        expect(c.baseLines).toEqual([
            'BLOCK_HEADER',
            'old_version',
            'common_line',
        ])
        expect(c.theirsLines).toEqual(['REPLACED_A', 'REPLACED_B'])
    })

    it('clusters multiple theirs hunks overlapping a single ours hunk into one chunk', () => {
        // Mirrors the package-lock.json bug: ours replaces base[1..4) with
        // three new lines; theirs makes two separate edits inside that same
        // base range (an insertion and a single-line replace). All four
        // hunks must collapse into ONE chunk whose ours/theirs content
        // exactly reproduces each side's actual text — without phantom
        // duplicate lines from naive coalesce.
        const base = join('a', 'X1', 'X2', 'X3', 'z')
        const ours = join('a', 'O1', 'O2', 'O3', 'z')
        const theirs = join('a', 'X1', 'INSERTED', 'X2', 'T3', 'z')

        const chunks = parse(ours, base, theirs)
        expect(chunks).toHaveLength(1)
        const c = chunks[0]
        expect(c.type).toBe('conflict')
        expect(c.baseStartLine).toBe(1)
        expect(c.baseEndLine).toBe(4)
        expect(c.oursLines).toEqual(['O1', 'O2', 'O3'])
        expect(c.theirsLines).toEqual(['X1', 'INSERTED', 'X2', 'T3'])
        expect(c.baseLines).toEqual(['X1', 'X2', 'X3'])
    })

    it('returns chunks sorted by baseStartLine', () => {
        const base = join('a', 'b', 'c', 'd')
        const ours = join('OURS_A', 'b', 'c', 'OURS_D')
        const theirs = join('a', 'b', 'c', 'd')

        const chunks = parse(ours, base, theirs)
        expect(chunks[0].baseStartLine).toBeLessThan(chunks[1].baseStartLine)
    })
})
