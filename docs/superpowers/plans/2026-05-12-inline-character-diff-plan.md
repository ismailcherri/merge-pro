# Inline Character-Level Diff Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add IntelliJ-style per-character inline diff highlighting on top of the existing whole-line band decorations in MergePro's three-pane merge editor. Always on; recomputed after every decision.

**Architecture:** A pure `inlineDiff` module wraps `diff-match-patch` with semantic cleanup. A `computePaneInlineDecorations` module walks `chunkMaps`, pairs each pane's lines against the correct basis (side panes ↔ Result, Result ↔ base), calls `inlineDiff` per line pair, and returns Monaco `IModelDeltaDecoration[]` per pane using `inlineClassName`. `ThreePaneEditor.tsx` merges these into the same decoration application that already paints line bands.

**Tech Stack:** TypeScript, Monaco editor decorations (`inlineClassName`), `diff-match-patch` library, Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-05-12-inline-character-diff-design.md`

---

## File Structure

- **Create** `webview/editor/inlineDiff.ts` — pure wrapper around `diff-match-patch`. Exports `computeInlineDiff(a, b)` returning `{ left: DiffSpan[]; right: DiffSpan[] }`.
- **Create** `webview/editor/computePaneInlineDecorations.ts` — given chunk maps + three documents + base text, walks chunks and produces `IModelDeltaDecoration[]` for each pane. Has no runtime dependency on Monaco (uses plain `IRange` object literals).
- **Create** `test/unit/inlineDiff.test.ts` — golden tests for the pure diff wrapper (runs under node env).
- **Create** `test/unit/computePaneInlineDecorations.test.ts` — fixture-driven tests for decoration computation (runs under node env).
- **Modify** `webview/editor/ThreePaneEditor.tsx` — add two CSS classes; call `computePaneInlineDecorations` from a `useMemo` keyed on chunks/text; merge result with existing line-band decorations.
- **Modify** `package.json` — add `diff-match-patch` runtime dep + `@types/diff-match-patch` dev dep.

---

## Task 1: Add `diff-match-patch` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime and types**

Run: `npm install diff-match-patch@^1.0.5 && npm install -D @types/diff-match-patch@^1.0.36`
Expected: both packages added to `package.json`, lock file updated.

- [ ] **Step 2: Verify install**

Run: `node -e "console.log(require('diff-match-patch').diff_match_patch)"`
Expected: prints `[Function: diff_match_patch]`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add diff-match-patch for inline diff highlighting"
```

---

## Task 2: `inlineDiff.ts` — types and empty module

**Files:**
- Create: `webview/editor/inlineDiff.ts`
- Test: `test/unit/inlineDiff.test.ts`

- [ ] **Step 1: Write the failing test for the API surface**

Create `test/unit/inlineDiff.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeInlineDiff } from '../../webview/editor/inlineDiff'

describe('computeInlineDiff', () => {
    it('returns empty spans when inputs are identical', () => {
        const r = computeInlineDiff('hello world', 'hello world')
        expect(r.left).toEqual([])
        expect(r.right).toEqual([])
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/inlineDiff.test.ts`
Expected: FAIL with module-not-found for `webview/editor/inlineDiff`.

- [ ] **Step 3: Write minimal implementation**

Create `webview/editor/inlineDiff.ts`:

```ts
export interface DiffSpan {
    /** Start offset within the line (0-indexed, inclusive). */
    start: number
    /** End offset within the line (0-indexed, exclusive). */
    end: number
    kind: 'added' | 'removed'
}

export interface InlineDiffResult {
    /** Spans within `a` that differ from `b` (kind: 'removed'). */
    left: DiffSpan[]
    /** Spans within `b` that differ from `a` (kind: 'added'). */
    right: DiffSpan[]
}

export function computeInlineDiff(a: string, b: string): InlineDiffResult {
    if (a === b) return { left: [], right: [] }
    return { left: [], right: [] }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/inlineDiff.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add webview/editor/inlineDiff.ts test/unit/inlineDiff.test.ts
git commit -m "feat(inline-diff): scaffold computeInlineDiff API"
```

---

## Task 3: `inlineDiff.ts` — implement char-level diffing

**Files:**
- Modify: `webview/editor/inlineDiff.ts`
- Modify: `test/unit/inlineDiff.test.ts`

- [ ] **Step 1: Write failing tests for the real behavior**

Append to `test/unit/inlineDiff.test.ts`:

```ts
describe('computeInlineDiff — character changes', () => {
    it('highlights single-character substitution (version bump)', () => {
        const r = computeInlineDiff('"^2.1.4",', '"^2.1.6",')
        // Left has the '4' as removed; right has the '6' as added.
        // (diff-match-patch may report adjacent equal context as separate
        // equal blocks; we only assert the *change* spans.)
        expect(r.left).toEqual([
            { start: 5, end: 6, kind: 'removed' },
        ])
        expect(r.right).toEqual([
            { start: 5, end: 6, kind: 'added' },
        ])
    })

    it('highlights multi-character substitution', () => {
        const r = computeInlineDiff('"next": "16.2.5",', '"next": "15.1.7",')
        // "16.2.5" -> "15.1.7" at offset 9..15 in both strings.
        expect(r.left).toEqual([
            { start: 9, end: 15, kind: 'removed' },
        ])
        expect(r.right).toEqual([
            { start: 9, end: 15, kind: 'added' },
        ])
    })

    it('highlights pure insertion (right longer than left)', () => {
        const r = computeInlineDiff('foo', 'foobar')
        expect(r.left).toEqual([])
        expect(r.right).toEqual([
            { start: 3, end: 6, kind: 'added' },
        ])
    })

    it('highlights pure deletion (left longer than right)', () => {
        const r = computeInlineDiff('foobar', 'foo')
        expect(r.left).toEqual([
            { start: 3, end: 6, kind: 'removed' },
        ])
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/inlineDiff.test.ts`
Expected: FAIL on all six new tests (empty arrays returned).

- [ ] **Step 3: Implement using diff-match-patch with semantic cleanup**

Replace `webview/editor/inlineDiff.ts` with:

```ts
import DiffMatchPatch from 'diff-match-patch'

const LONG_LINE_THRESHOLD = 1000

const dmp = new DiffMatchPatch.diff_match_patch()
// Cap the per-call diff time. diff-match-patch is fast for typical input
// but quadratic worst case; this prevents pathological lines from blocking.
dmp.Diff_Timeout = 0.1 // seconds

export interface DiffSpan {
    start: number
    end: number
    kind: 'added' | 'removed'
}

export interface InlineDiffResult {
    left: DiffSpan[]
    right: DiffSpan[]
}

export function computeInlineDiff(a: string, b: string): InlineDiffResult {
    if (a === b) return { left: [], right: [] }

    if (a.length > LONG_LINE_THRESHOLD || b.length > LONG_LINE_THRESHOLD) {
        return {
            left: a.length > 0 ? [{ start: 0, end: a.length, kind: 'removed' }] : [],
            right: b.length > 0 ? [{ start: 0, end: b.length, kind: 'added' }] : [],
        }
    }

    const diffs = dmp.diff_main(a, b)
    dmp.diff_cleanupSemantic(diffs)

    const left: DiffSpan[] = []
    const right: DiffSpan[] = []
    let leftPos = 0
    let rightPos = 0

    for (const [op, text] of diffs) {
        if (op === 0) {
            // EQUAL — advance both cursors.
            leftPos += text.length
            rightPos += text.length
        } else if (op === -1) {
            // DELETE — span exists in `a` only.
            left.push({ start: leftPos, end: leftPos + text.length, kind: 'removed' })
            leftPos += text.length
        } else if (op === 1) {
            // INSERT — span exists in `b` only.
            right.push({ start: rightPos, end: rightPos + text.length, kind: 'added' })
            rightPos += text.length
        }
    }

    return { left, right }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/inlineDiff.test.ts`
Expected: PASS (7 tests total).

- [ ] **Step 5: Commit**

```bash
git add webview/editor/inlineDiff.ts test/unit/inlineDiff.test.ts
git commit -m "feat(inline-diff): implement char-level diff via diff-match-patch"
```

---

## Task 4: `computePaneInlineDecorations.ts` — scaffold & first test

**Files:**
- Create: `webview/editor/computePaneInlineDecorations.ts`
- Test: `test/unit/computePaneInlineDecorations.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/unit/computePaneInlineDecorations.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computePaneInlineDecorations } from '../../webview/editor/computePaneInlineDecorations'
import type { ChunkLineMap } from '../../webview/editor/buildDisplayDocuments'

describe('computePaneInlineDecorations', () => {
    it('returns empty arrays when there are no chunks', () => {
        const r = computePaneInlineDecorations({
            ours: '',
            result: '',
            theirs: '',
            baseText: '',
            chunkMaps: [],
        })
        expect(r.ours).toEqual([])
        expect(r.result).toEqual([])
        expect(r.theirs).toEqual([])
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/computePaneInlineDecorations.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write minimal implementation**

Create `webview/editor/computePaneInlineDecorations.ts`:

```ts
import type { ChunkLineMap } from './buildDisplayDocuments'

/**
 * Plain Monaco IRange-shaped object. Avoids importing `monaco-editor` at
 * runtime so this module stays testable under a node environment.
 */
export interface InlineRange {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
}

export interface InlineDecoration {
    range: InlineRange
    options: {
        inlineClassName: string
    }
}

export interface PaneInlineDecorations {
    ours: InlineDecoration[]
    result: InlineDecoration[]
    theirs: InlineDecoration[]
}

export interface ComputeInput {
    ours: string
    result: string
    theirs: string
    baseText: string
    chunkMaps: ChunkLineMap[]
}

export function computePaneInlineDecorations(
    input: ComputeInput
): PaneInlineDecorations {
    void input
    return { ours: [], result: [], theirs: [] }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/computePaneInlineDecorations.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add webview/editor/computePaneInlineDecorations.ts test/unit/computePaneInlineDecorations.test.ts
git commit -m "feat(inline-diff): scaffold computePaneInlineDecorations"
```

---

## Task 5: `computePaneInlineDecorations.ts` — pair side-pane lines vs. Result

**Files:**
- Modify: `webview/editor/computePaneInlineDecorations.ts`
- Modify: `test/unit/computePaneInlineDecorations.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/computePaneInlineDecorations.test.ts`:

```ts
describe('computePaneInlineDecorations — side panes vs. Result', () => {
    it('highlights character changes in the ours pane against Result', () => {
        // One chunk: line 1 of each doc.
        //   ours:   "next": "16.2.5",
        //   result: "next": "15.1.7",
        //   theirs: "next": "15.1.7",
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
        })
        // Ours pane: chars 9..15 (the version) differ from result.
        // Monaco columns are 1-based: start=10, end=16.
        expect(r.ours).toEqual([
            {
                range: {
                    startLineNumber: 1,
                    startColumn: 10,
                    endLineNumber: 1,
                    endColumn: 16,
                },
                options: { inlineClassName: 'mp-inline-removed' },
            },
        ])
        // Theirs pane matches result exactly -> no decorations.
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
        // Ours has 2 lines in this chunk, Result has 1, Theirs has 1.
        // Line-pair counts: min(2,1) = 1 -> only line 1 paired; line 2 of
        // ours gets no inline span.
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
        })
        // Line 1 matches result exactly -> nothing. Line 2 has no pair ->
        // nothing.
        expect(r.ours).toEqual([])
    })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/computePaneInlineDecorations.test.ts`
Expected: FAIL on the three new tests.

- [ ] **Step 3: Implement the side-pane logic**

Replace the body of `computePaneInlineDecorations` in `webview/editor/computePaneInlineDecorations.ts`:

```ts
import type { ChunkLineMap, LineRange } from './buildDisplayDocuments'
import { computeInlineDiff, type DiffSpan } from './inlineDiff'

export interface InlineRange {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
}

export interface InlineDecoration {
    range: InlineRange
    options: { inlineClassName: string }
}

export interface PaneInlineDecorations {
    ours: InlineDecoration[]
    result: InlineDecoration[]
    theirs: InlineDecoration[]
}

export interface ComputeInput {
    ours: string
    result: string
    theirs: string
    baseText: string
    chunkMaps: ChunkLineMap[]
}

function splitLines(text: string): string[] {
    const lines = text.replace(/\r\n/g, '\n').split('\n')
    if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop()
    return lines
}

function rangeLineCount(r: LineRange): number {
    if (r.end < r.start) return 0
    return r.end - r.start + 1
}

function spansToDecorations(
    spans: DiffSpan[],
    lineNumber: number
): InlineDecoration[] {
    return spans.map((s) => ({
        range: {
            startLineNumber: lineNumber,
            startColumn: s.start + 1,
            endLineNumber: lineNumber,
            endColumn: s.end + 1,
        },
        options: {
            inlineClassName:
                s.kind === 'added' ? 'mp-inline-added' : 'mp-inline-removed',
        },
    }))
}

export function computePaneInlineDecorations(
    input: ComputeInput
): PaneInlineDecorations {
    const oursLines = splitLines(input.ours)
    const resultLines = splitLines(input.result)
    const theirsLines = splitLines(input.theirs)

    const ours: InlineDecoration[] = []
    const result: InlineDecoration[] = []
    const theirs: InlineDecoration[] = []

    for (const map of input.chunkMaps) {
        if (!map) continue
        const oursN = rangeLineCount(map.ours)
        const resultN = rangeLineCount(map.result)
        const theirsN = rangeLineCount(map.theirs)

        // Ours vs. Result
        const oursResultPairs = Math.min(oursN, resultN)
        for (let k = 0; k < oursResultPairs; k++) {
            const oursLineNo = map.ours.start + k
            const resultLineNo = map.result.start + k
            const a = oursLines[oursLineNo - 1] ?? ''
            const b = resultLines[resultLineNo - 1] ?? ''
            const d = computeInlineDiff(a, b)
            ours.push(...spansToDecorations(d.left, oursLineNo))
        }

        // Theirs vs. Result
        const theirsResultPairs = Math.min(theirsN, resultN)
        for (let k = 0; k < theirsResultPairs; k++) {
            const theirsLineNo = map.theirs.start + k
            const resultLineNo = map.result.start + k
            const a = theirsLines[theirsLineNo - 1] ?? ''
            const b = resultLines[resultLineNo - 1] ?? ''
            const d = computeInlineDiff(a, b)
            theirs.push(...spansToDecorations(d.left, theirsLineNo))
        }
    }

    return { ours, result, theirs }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/unit/computePaneInlineDecorations.test.ts`
Expected: PASS (4 tests total).

- [ ] **Step 5: Commit**

```bash
git add webview/editor/computePaneInlineDecorations.ts test/unit/computePaneInlineDecorations.test.ts
git commit -m "feat(inline-diff): pair side-pane lines vs Result for inline decorations"
```

---

## Task 6: `computePaneInlineDecorations.ts` — Result pane vs. base

**Files:**
- Modify: `webview/editor/computePaneInlineDecorations.ts`
- Modify: `test/unit/computePaneInlineDecorations.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `test/unit/computePaneInlineDecorations.test.ts`:

```ts
describe('computePaneInlineDecorations — Result vs. base', () => {
    it('highlights changes in Result relative to base', () => {
        // Base has one line. Chunk covers it. Result line differs.
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
        })
        // Result pane "added" span at column 11..12 (the '1' that replaced '0').
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
        })
        expect(r.result).toEqual([])
    })
})
```

Note: the Result pane is paired with the merge **base** by reading the base text. The chunk's `result` range tells us which Result lines belong to this chunk, but base lines are not tracked in `ChunkLineMap` — we need the chunk's `baseStartLine` / `baseEndLine`. Update `ComputeInput` to accept this too.

- [ ] **Step 2: Update `ComputeInput` to include per-chunk base ranges**

In `webview/editor/computePaneInlineDecorations.ts`, change `ComputeInput`:

```ts
export interface ChunkBaseRange {
    /** 1-indexed inclusive base line range. If end < start, treat as empty. */
    start: number
    end: number
}

export interface ComputeInput {
    ours: string
    result: string
    theirs: string
    baseText: string
    chunkMaps: ChunkLineMap[]
    /** Parallel to `chunkMaps`. 1-indexed inclusive base line ranges per chunk. */
    chunkBaseRanges: ChunkBaseRange[]
}
```

And update the two existing tests in `test/unit/computePaneInlineDecorations.test.ts` to pass `chunkBaseRanges`. For every existing chunk-fixture, add (the values don't matter for side-pane tests; use `{ start: 1, end: 1 }`):

```ts
chunkBaseRanges: [{ start: 1, end: 1 }],
```

Update the empty-chunks test to pass `chunkBaseRanges: []`.

For the two new tests added in Step 1, also include `chunkBaseRanges: [{ start: 1, end: 1 }]`.

- [ ] **Step 3: Run tests to verify they fail in the expected way**

Run: `npx vitest run test/unit/computePaneInlineDecorations.test.ts`
Expected: FAIL on the two new Result-vs-base tests; existing tests still PASS (the new field is accepted but unused).

- [ ] **Step 4: Implement Result-vs-base pairing**

In `webview/editor/computePaneInlineDecorations.ts`, inside the `for (const map of input.chunkMaps)` loop, add this block alongside the existing ours/theirs pairing:

```ts
const baseRange = input.chunkBaseRanges[input.chunkMaps.indexOf(map)]
if (baseRange) {
    const baseLines = splitLines(input.baseText)
    const baseN =
        baseRange.end < baseRange.start ? 0 : baseRange.end - baseRange.start + 1
    const resultBasePairs = Math.min(resultN, baseN)
    for (let k = 0; k < resultBasePairs; k++) {
        const resultLineNo = map.result.start + k
        const baseLineNo = baseRange.start + k
        const a = baseLines[baseLineNo - 1] ?? ''
        const b = resultLines[resultLineNo - 1] ?? ''
        const d = computeInlineDiff(a, b)
        result.push(...spansToDecorations(d.right, resultLineNo))
    }
}
```

Note: `d.right` is used (not `d.left`) because Result is the second argument and "added" spans live in `right`. The `mp-inline-added` class is applied.

Also: `input.chunkMaps.indexOf(map)` is O(N²) — refactor the outer loop to use an index:

Replace `for (const map of input.chunkMaps)` with:

```ts
for (let chunkIdx = 0; chunkIdx < input.chunkMaps.length; chunkIdx++) {
    const map = input.chunkMaps[chunkIdx]
    if (!map) continue
    // ... existing oursN, resultN, theirsN calculations ...
    // ... existing ours-vs-Result and theirs-vs-Result blocks ...
    const baseRange = input.chunkBaseRanges[chunkIdx]
    if (baseRange) {
        // ... new Result-vs-base block above ...
    }
}
```

Hoist `const baseLines = splitLines(input.baseText)` out of the loop to before it starts.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/unit/computePaneInlineDecorations.test.ts`
Expected: PASS (6 tests total).

- [ ] **Step 6: Commit**

```bash
git add webview/editor/computePaneInlineDecorations.ts test/unit/computePaneInlineDecorations.test.ts
git commit -m "feat(inline-diff): add Result-vs-base pairing for Result pane"
```

---

## Task 7: Add CSS styles to `ThreePaneEditor.tsx`

**Files:**
- Modify: `webview/editor/ThreePaneEditor.tsx:55-72`

- [ ] **Step 1: Add the inline-diff CSS classes**

In `webview/editor/ThreePaneEditor.tsx`, inside the existing `style.textContent` template literal (currently lines 55–72), append two new rules at the end:

```css
.mp-inline-added   { background: var(--vscode-diffEditor-insertedTextBackground, rgba(98,178,98,0.30)); }
.mp-inline-removed { background: var(--vscode-diffEditor-removedTextBackground,  rgba(220,80,70,0.30)); }
```

So the full `style.textContent` ends with these two new lines just before the closing backtick.

- [ ] **Step 2: Verify the webview still builds**

Run: `npm run build:webview`
Expected: build succeeds, no TS errors.

- [ ] **Step 3: Commit**

```bash
git add webview/editor/ThreePaneEditor.tsx
git commit -m "feat(inline-diff): add CSS classes for inline added/removed spans"
```

---

## Task 8: Wire `computePaneInlineDecorations` into `ThreePaneEditor`

**Files:**
- Modify: `webview/editor/ThreePaneEditor.tsx`

- [ ] **Step 1: Import the new module and add inline decorations memo**

In `webview/editor/ThreePaneEditor.tsx`, add the import alongside existing webview/editor imports (after the `buildDisplayDocuments` import, around line 9):

```ts
import {
    computePaneInlineDecorations,
    type ChunkBaseRange,
} from './computePaneInlineDecorations'
```

Then, after the existing `theirsDecorations` `useMemo` (around line 209), insert:

```ts
const chunkBaseRanges = useMemo<ChunkBaseRange[]>(
    () =>
        chunks.map((c) => ({
            start: c.baseStartLine + 1, // baseStartLine is 0-indexed; map to 1-indexed.
            end: c.baseEndLine,          // baseEndLine is exclusive 0-indexed; inclusive 1-indexed == same number.
        })),
    [chunks]
)

const inlineDecorations = useMemo(
    () =>
        computePaneInlineDecorations({
            ours,
            result,
            theirs,
            baseText,
            chunkMaps,
            chunkBaseRanges,
        }),
    [ours, result, theirs, baseText, chunkMaps, chunkBaseRanges]
)
```

Note on the 0/1-index conversion: `ConflictChunk.baseStartLine` is 0-indexed inclusive and `baseEndLine` is 0-indexed exclusive (per `src/protocol.ts` conventions — verify by reading that file before writing this task). If those conventions differ in this codebase, adjust the mapping so `chunkBaseRanges[i]` matches the 1-indexed inclusive convention used by `ChunkLineMap`. If the chunk has zero base lines (pure insertion), `end < start` will hold and `computePaneInlineDecorations` already treats that as empty.

- [ ] **Step 2: Verify the base-line indexing assumption**

Run: `grep -n 'baseStartLine\|baseEndLine' src/protocol.ts | head -20`
Expected: confirms whether `baseStartLine`/`baseEndLine` are 0- or 1-indexed and whether `baseEndLine` is inclusive or exclusive. Adjust the mapping in Step 1 if needed before continuing.

- [ ] **Step 3: Merge inline decorations into the three pane decoration arrays**

In `webview/editor/ThreePaneEditor.tsx`, change the three existing decoration `useMemo` calls (around lines 198–209) so each returns the existing line-band decorations **concatenated with** the inline decorations:

```ts
const oursDecorations = useMemo(
    () => [
        ...buildPaneDecorations(chunks, chunkMaps, 'ours'),
        ...inlineDecorations.ours,
    ],
    [chunks, chunkMaps, inlineDecorations]
)
const resultDecorations = useMemo(
    () => [
        ...buildPaneDecorations(chunks, chunkMaps, 'result'),
        ...inlineDecorations.result,
    ],
    [chunks, chunkMaps, inlineDecorations]
)
const theirsDecorations = useMemo(
    () => [
        ...buildPaneDecorations(chunks, chunkMaps, 'theirs'),
        ...inlineDecorations.theirs,
    ],
    [chunks, chunkMaps, inlineDecorations]
)
```

These three memos must appear **after** the `inlineDecorations` memo from Step 1. Reorder if necessary so declarations precede use.

- [ ] **Step 4: Verify the type of inline decorations is compatible**

The `decorations` prop on `EditorPane` is `monaco.editor.IModelDeltaDecoration[]`. Our `InlineDecoration` has shape `{ range: IRange-like, options: { inlineClassName: string } }`, which structurally satisfies `IModelDeltaDecoration`. Run:

Run: `npm run build`
Expected: build succeeds. If TypeScript complains about the merged array types, add a type assertion on the inline arrays: `...(inlineDecorations.ours as monaco.editor.IModelDeltaDecoration[])`. Do the same for `.result` and `.theirs`.

- [ ] **Step 5: Commit**

```bash
git add webview/editor/ThreePaneEditor.tsx
git commit -m "feat(inline-diff): wire inline char-level decorations into three-pane editor"
```

---

## Task 9: Run the full test suite

**Files:** (no changes)

- [ ] **Step 1: Run unit tests**

Run: `npm test`
Expected: all existing tests still pass; new tests pass (the node-env run picks up `test/unit/inlineDiff.test.ts` and `test/unit/computePaneInlineDecorations.test.ts`).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no lint errors.

- [ ] **Step 3: If tests or lint fail, fix and commit**

```bash
git add -A
git commit -m "fix(inline-diff): address test/lint feedback"
```

If they pass, skip this commit.

---

## Task 10: Manual verification in the VS Code extension host

**Files:** (no changes)

- [ ] **Step 1: Build the extension**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 2: Launch the extension host**

In VS Code, press **F5** (or run the "Run Extension" launch task).
Expected: a new Extension Development Host window opens.

- [ ] **Step 3: Open a fixture with rich inline changes**

In the dev host, open `test-fixtures/` (or any repo with a real conflict). Trigger `MergePro: Open Merge Editor` on a file with character-level changes — `package-lock.json` from the reference screenshot is ideal. Look for:

- Whole-line bands still appear (existing behavior unchanged).
- Within changed lines, only the differing characters/words have the darker translucent highlight on top of the band.
- Side panes (ours/theirs) show highlights against the Result pane.
- Result pane shows highlights against base.

- [ ] **Step 4: Verify decisions trigger recompute**

In the same merge editor, click the accept-ours (`»`) button on a chunk. Expected:
- Result line updates to match ours.
- Ours pane's inline highlights for that chunk disappear (now identical to Result).
- Theirs pane's inline highlights for that chunk may grow (theirs now differs from the updated Result).

Click undo (Cmd/Ctrl+Z). Expected: highlights revert.

- [ ] **Step 5: Verify long-line fallback**

Open a file with a very long minified line (>1000 chars) that differs between panes. Expected: that line gets a single solid inline highlight (whole-line span), not character-level. The editor remains responsive.

- [ ] **Step 6: If issues are found, file fixes as additional commits**

For each issue, write a failing test first (in `test/unit/`), fix, run `npm test`, then commit with a clear message. Do not skip the failing-test step.

- [ ] **Step 7: Final commit (if any docs/CHANGELOG updates)**

Update `CHANGELOG.md` with a one-line entry under the unreleased section:

```
- Add IntelliJ-style inline character-level diff highlighting in the three-pane merge editor.
```

```bash
git add CHANGELOG.md
git commit -m "docs: note inline char-level diff in changelog"
```

---

## Self-Review Notes

Spec coverage check:
- Comparison basis (sides ↔ Result, Result ↔ base): Tasks 5 and 6.
- diff-match-patch with semantic cleanup: Task 3.
- Hybrid word/char via `diff_cleanupSemantic`: Task 3 (relies on library behavior — tests verify representative outputs).
- Always on, all three panes: Task 8 wires all three.
- Recompute on decision: Task 8's `useMemo` deps include `chunks` and the derived text, which change on every decision (the existing `buildDisplayDocuments` memo already proves this).
- Always-on (no toggle): no toggle UI added anywhere.
- CSS via theme variables: Task 7.
- `inlineClassName` (not `className`): Tasks 5/6 emit `inlineClassName`.
- Long-line cap at 1000 chars: Task 3 implementation + Task 10 manual verification.
- Pure insert/delete lines: Task 5 (third test) verifies no spans for unpaired lines.
- N ≠ M line pairing: Task 5 (`Math.min(N, M)`).
- Manual edits in Result re-diff against base on next tick: Task 8's memo deps include `result` (derived from chunks).
- Files touched list from spec: matches Tasks 1, 2/3, 4–6, 7, 8 exactly.

Viewport-scoped lazy computation from the spec's Performance section is **not** in this plan. The simpler always-compute-all approach is fast enough for typical files because `diff-match-patch` is sub-millisecond per normal-length line and the recompute is memoized on text identity. If the `package-lock.json` case in Task 10 is sluggish, add a follow-up plan for viewport scoping — don't prematurely optimize.

Per-chunk caching keyed by content hash from the spec's Performance section is also deferred for the same reason; React's `useMemo` already provides whole-input memoization.

Placeholder scan: no TBDs, no "implement later", every step has either exact code or an exact command with expected output.

Type consistency: `DiffSpan`, `InlineDecoration`, `ChunkBaseRange`, `ComputeInput`, `PaneInlineDecorations` are defined once in Tasks 2/4/6 and referenced consistently in Tasks 5/6/8.
