# IntelliJ-style Three-Pane Merge Editor

## Context

The current merge editor layout is Ours | Result | Theirs with the center pane being editable. This doesn't match IntelliJ's 3-way merge UX. The user wants the IntelliJ layout with vertical synchronization (the "growing/shrinking" effect) where conflict chunks are padded to equal height across all three panes, and inline accept buttons in the gutters.

## Design

### Layout

```
[Toolbar: Prev/Next nav, Auto-Resolve, Save]
[Ours | gutter+buttons | Base | gutter+buttons | Theirs]
[Result editor — full width, editable]
```

- Ours/Base/Theirs: readonly Monaco editors with identical line counts (via padding)
- Result: editable Monaco editor, full width below
- Gutters: SVG polygons split into clickable Accept Left / Accept Right zones

### Data model

Add `baseLines: string[]` to `ConflictChunk` in `src/protocol.ts`. The parser already computes this; it just needs to include it.

### Padding algorithm

For each chunk, compute `maxLines = max(oursLines.length, baseLines.length, theirsLines.length)`. Pad shorter sides with empty strings. Non-chunk regions (unchanged base) are copied identically to all three panes. Result: three strings with identical line counts — scroll sync works via `setScrollTop()`.

Padded lines get a dimmed decoration to visually distinguish them from real code. When a chunk is accepted, all three panes show the chosen version uniformly (no padding needed), creating the "shrinking" effect.

### Gutter interactions

Each SVG polygon in the gutter is split into two clickable zones:

- Left half → Accept Ours (with visual indicator on hover)
- Right half → Accept Theirs (with visual indicator on hover)

Non-conflicting chunks: dimmed polygon, no click action (auto-applied).
Resolved chunks: green polygon indicating accepted side.

### Toolbar

Simplified — bulk accept buttons removed (now per-chunk). Only: filename, conflict counter, Prev/Next navigation, Auto-Resolve, Save.

### Result pane

Shows the resolved file content (base + all accepted chunks applied). Auto-scrolls to the current conflict. Editable for manual adjustments.

## Files to change

- `src/protocol.ts` — add `baseLines` to ConflictChunk
- `src/parsers/ConflictParser.ts` — populate baseLines per chunk
- `webview/editor/App.tsx` — pass baseText, wire inline accept handlers
- `webview/editor/ThreePaneEditor.tsx` — major rewrite: padding + three-pane + result
- `webview/editor/GutterConnector.tsx` — clickable split polygons
- `webview/editor/Toolbar.tsx` — simplify, remove bulk accept
- `webview/editor/EditorPane.tsx` — minor (scroll sync adjustments)
- `test/unit/webview/panel.test.tsx` — update if chunk shape changes
- `test/unit/webview/GutterConnector.test.tsx` — update for new gutter API

## Unchanged

- `src/services/MergeSessionManager.ts` — session logic unchanged
- `src/services/GitService.ts` — git integration unchanged
- `src/providers/*` — extension host providers unchanged
- `src/utils/ConflictResolver.ts` — resolution logic unchanged
- Panel webview — unaffected
