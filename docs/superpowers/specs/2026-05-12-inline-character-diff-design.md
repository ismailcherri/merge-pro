# Inline Character-Level Diff Highlighting — Design Spec

**Date:** 2026-05-12
**Status:** Approved (pending implementation plan)
**Related:** [[2026-05-06-intellij-merge-editor-design]]

## Goal

Bring IntelliJ-style inline character/word diff highlighting to MergePro's three-pane merge editor. Today the editor paints whole-line bands over changed lines; this spec adds a second layer of decoration that highlights the specific characters that differ within each changed line, so users can see at a glance what actually changed (e.g. `"^2.1.4"` → `"^2.1.6"` highlights just the `4`/`6`).

The feature is **always on** in all three panes (`test` / `Result` / `main`) and **recomputes after every decision** (accept ours/theirs, manual edit, undo).

## Comparison basis

- **Side panes (test, main):** each line is diffed against the corresponding line in the **Result** pane.
- **Result pane:** each line is diffed against the corresponding line in the **merge base**.

This gives the IntelliJ feel: accepting a side's chunk causes that pane's inline highlights for the chunk to disappear, because the side now matches Result. Inline highlights collapse as the user resolves conflicts, providing visual feedback on remaining work.

## Diff algorithm

Use **`diff-match-patch`** (Google's library) with `diff_cleanupSemantic()`. The semantic cleanup pass produces the hybrid word-then-character grouping we want without us writing a two-pass algorithm: short runs of common characters between two changes get merged, and word boundaries are respected where it improves readability. For typical code changes (version bumps, identifier renames, value edits) this produces tight, readable highlights matching IntelliJ's output.

`diff-match-patch` is ~50KB minified, fast (linear on normal input), and battle-tested.

## Architecture

### New modules

**`webview/editor/inlineDiff.ts`**
A pure function wrapping `diff-match-patch`:

```ts
type DiffSpan = { start: number; end: number; kind: 'added' | 'removed' };
function computeInlineDiff(a: string, b: string): { left: DiffSpan[]; right: DiffSpan[] };
```

The `left` spans correspond to ranges in `a` (typically the side-pane line); `right` spans correspond to ranges in `b` (the Result/base line). Lines longer than 1000 characters short-circuit and return whole-line spans (see Performance below).

**`webview/editor/computePaneInlineDecorations.ts`**
Given the three pane documents plus the chunk map already produced by `buildDisplayDocuments.ts`, walks each chunk and:

- For each side-pane line, pairs it with the corresponding Result line (by line index within the chunk) and calls `computeInlineDiff`.
- For each Result-pane line, pairs it with the corresponding merge-base line and calls `computeInlineDiff`.
- For lines with no counterpart in the paired pane (pure insertions or deletions), emits no inline decorations — the line keeps the existing whole-line band only.
- Returns three arrays of Monaco `IModelDeltaDecoration` objects, one per pane.

### Wiring

In `ThreePaneEditor.tsx`, after the existing decoration pass that paints whole-line bands, call `computePaneInlineDecorations` and merge its decorations into the same `deltaDecorations` call per Monaco editor. Single decoration application per pane per update — Monaco handles diffing internally and only re-renders changed ranges.

The recompute hooks into the same `useEffect` that already reacts to chunk-state changes (the one that fires on accept ours/theirs/manual edit/undo). No new subscriptions.

## Rendering

Two CSS classes added to the existing webview stylesheet:

- `.mp-inline-added` — translucent inserted-text background, using `var(--vscode-diffEditor-insertedTextBackground)`.
- `.mp-inline-removed` — translucent removed-text background, using `var(--vscode-diffEditor-removedTextBackground)`.

Both layer on top of the existing line bands and inherit the user's VS Code theme automatically (same approach as the rest of MergePro). Applied as Monaco `inlineClassName` decorations (character-range, not full-line) — this is the same API Monaco's own diff editor uses, so word-wrap, selection, folding, and accessibility behave as users expect.

## Performance & recompute strategy

`package-lock.json`-scale files (387+ changed chunks in the reference screenshot) require care.

1. **Viewport-scoped computation.** Only compute inline diffs for chunks intersecting Monaco's current viewport. Hook into `onDidScrollChange` to extend the computed set as the user scrolls. Off-screen chunks remain at whole-line-band fidelity until scrolled into view.
2. **Per-chunk caching.** Results are cached on the chunk object, keyed by a content hash of the paired lines. On decision events, only the affected chunk's cache is invalidated.
3. **Long-line cap.** Lines longer than 1000 characters skip char-level computation and fall back to a single whole-line inline span. Protects against `diff-match-patch`'s quadratic worst case on adversarial input (minified JSON, lock files).
4. **No debouncing needed.** Per-chunk recompute is synchronous and sub-millisecond for typical lines; the chunk-state effect fires at most once per user action.

## Edge cases

| Case | Behavior |
|---|---|
| Pure insertion / deletion (one side has the line, other doesn't) | Whole-line band only; no inline spans. |
| Whitespace-only difference | Highlighted normally; `diff_cleanupSemantic` produces clean output. |
| Multi-line chunks where N ≠ M lines per side | Pair greedily by index up to `min(N, M)`; trailing lines on the longer side get the whole-line band only. |
| Manual edits in Result | Re-diff against base on the next chunk-state tick; highlights update live. |
| Lines > 1000 chars | Fall back to a single whole-line inline span. |
| Binary / non-text content | Out of scope; existing MergePro behavior unchanged. |

## Out of scope

- A toggle / dropdown to disable inline highlights (always on per user request).
- Configurable granularity modes (word-only, char-only). The hybrid output via `diff_cleanupSemantic` is the only mode.
- Diff between side panes directly (the comparison basis is sides-vs-Result and Result-vs-base, not sides-vs-each-other).

## Testing

- **Unit:** `inlineDiff.ts` — golden tests for representative cases (version bump, identifier rename, whitespace change, pure insert/delete, long line cap).
- **Unit:** `computePaneInlineDecorations.ts` — given fixture chunk maps, assert produced decoration ranges.
- **Integration (webview):** render `ThreePaneEditor` against a fixture session, assert decorations are present on expected ranges and disappear/update after a simulated decision.
- **Manual:** load the `package-lock.json` reference case and verify scrolling stays smooth and highlights match IntelliJ's output on representative lines.

## Files touched

- New: `webview/editor/inlineDiff.ts`
- New: `webview/editor/computePaneInlineDecorations.ts`
- New: corresponding `*.test.ts` files
- Modified: `webview/editor/ThreePaneEditor.tsx` (wire inline decorations into existing decoration pass + viewport scroll hook)
- Modified: webview stylesheet (add `.mp-inline-added` / `.mp-inline-removed`)
- Modified: `package.json` (add `diff-match-patch` dependency + `@types/diff-match-patch`)
