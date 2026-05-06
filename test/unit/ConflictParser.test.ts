import { describe, it, expect } from 'vitest';
import { parse } from '../../src/parsers/ConflictParser';

const join = (...lines: string[]) => lines.join('\n');

describe('ConflictParser.parse', () => {
  it('returns empty array when all three versions are identical', () => {
    const text = join('line1', 'line2', 'line3');
    expect(parse(text, text, text)).toEqual([]);
  });

  it('detects a non-conflicting change from ours only', () => {
    const base = join('a', 'b', 'c');
    const ours = join('a', 'CHANGED', 'c');
    const theirs = join('a', 'b', 'c');

    const chunks = parse(ours, base, theirs);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('non-conflicting');
    expect(chunks[0].oursLines).toEqual(['CHANGED']);
    expect(chunks[0].baseLines).toEqual(['b']);
    expect(chunks[0].theirsLines).toEqual(['b']);
    expect(chunks[0].baseStartLine).toBe(1);
    expect(chunks[0].baseEndLine).toBe(2);
    expect(chunks[0].resolvedWith).toBeUndefined();
  });

  it('detects a non-conflicting change from theirs only', () => {
    const base = join('a', 'b', 'c');
    const ours = join('a', 'b', 'c');
    const theirs = join('a', 'THEIRS', 'c');

    const chunks = parse(ours, base, theirs);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('non-conflicting');
    expect(chunks[0].oursLines).toEqual(['b']);
    expect(chunks[0].theirsLines).toEqual(['THEIRS']);
  });

  it('detects a true conflict when both sides change the same line', () => {
    const base = join('a', 'b', 'c');
    const ours = join('a', 'OURS', 'c');
    const theirs = join('a', 'THEIRS', 'c');

    const chunks = parse(ours, base, theirs);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('conflict');
    expect(chunks[0].oursLines).toEqual(['OURS']);
    expect(chunks[0].baseLines).toEqual(['b']);
    expect(chunks[0].theirsLines).toEqual(['THEIRS']);
    expect(chunks[0].baseStartLine).toBe(1);
    expect(chunks[0].baseEndLine).toBe(2);
  });

  it('handles both a conflict and a non-conflicting change in the same file', () => {
    const base = join('a', 'b', 'c', 'd');
    const ours = join('a', 'OURS', 'c', 'd');
    const theirs = join('a', 'THEIRS', 'c', 'THEIRS_D');

    const chunks = parse(ours, base, theirs);
    // line b: conflict (both changed)
    // line d: non-conflicting (only theirs)
    expect(chunks).toHaveLength(2);
    const conflict = chunks.find(c => c.type === 'conflict')!;
    const nonConflict = chunks.find(c => c.type === 'non-conflicting')!;
    expect(conflict.oursLines).toEqual(['OURS']);
    expect(conflict.theirsLines).toEqual(['THEIRS']);
    expect(nonConflict.theirsLines).toEqual(['THEIRS_D']);
  });

  it('handles ours adding lines (insertion)', () => {
    const base = join('a', 'c');
    const ours = join('a', 'NEW1', 'NEW2', 'c');
    const theirs = join('a', 'c');

    const chunks = parse(ours, base, theirs);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('non-conflicting');
    expect(chunks[0].oursLines).toEqual(['NEW1', 'NEW2']);
    expect(chunks[0].theirsLines).toEqual([]);
    expect(chunks[0].baseStartLine).toBe(1);
    expect(chunks[0].baseEndLine).toBe(1); // pure insertion at base line 1
  });

  it('handles Windows line endings (CRLF)', () => {
    const base = 'a\r\nb\r\nc';
    const ours = 'a\r\nCHANGED\r\nc';
    const theirs = 'a\r\nb\r\nc';

    const chunks = parse(ours, base, theirs);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('non-conflicting');
  });

  it('returns empty array for empty files', () => {
    expect(parse('', '', '')).toEqual([]);
  });

  it('treats identical changes on both sides as non-conflicting', () => {
    const base = join('a', 'b', 'c');
    const both = join('a', 'NEW', 'c');
    const chunks = parse(both, base, both);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('non-conflicting');
    expect(chunks[0].oursLines).toEqual(['NEW']);
    expect(chunks[0].theirsLines).toEqual(['NEW']);
  });

  it('returns no conflict when both sides delete all content', () => {
    const base = join('a', 'b', 'c');
    const chunks = parse('', base, '');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe('non-conflicting');
    expect(chunks[0].oursLines).toEqual([]);
    expect(chunks[0].theirsLines).toEqual([]);
  });

  it('handles trailing CRLF without spurious chunks', () => {
    // All three versions identical except trailing CRLF — should produce no chunks
    const text = 'a\r\nb\r\nc\r\n';
    expect(parse(text, text, text)).toEqual([]);
  });

  it('returns chunks sorted by baseStartLine', () => {
    const base = join('a', 'b', 'c', 'd');
    const ours = join('OURS_A', 'b', 'c', 'OURS_D');
    const theirs = join('a', 'b', 'c', 'd');

    const chunks = parse(ours, base, theirs);
    expect(chunks[0].baseStartLine).toBeLessThan(chunks[1].baseStartLine);
  });
});
