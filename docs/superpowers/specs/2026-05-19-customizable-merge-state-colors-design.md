# Customizable Merge State Colors — Design

**Date:** 2026-05-19
**Status:** Approved — ready for implementation plan

## Goal

Let users override MergePro's chunk-state highlight colors without forking the extension, using VS Code's native theming machinery. Defaults match today's hardcoded values so installed users see no visual change after upgrading.

## Non-goals

- A custom in-extension settings UI or color picker panel.
- Theming the toolbar, decision buttons, or magic column — only the six chunk-state highlights.
- Built-in theme presets (e.g. "high contrast" / "pastel").
- Migration from any pre-existing user config (there is none — colors have never been user-configurable).

## Mechanism

Use VS Code's `contributes.colors` extension point. Each color becomes a named token with `dark` / `light` / `highContrast` defaults. Users override per-theme via `workbench.colorCustomizations` in `settings.json`:

```jsonc
"workbench.colorCustomizations": {
  "mergePro.conflict.oursBackground": "#883333"
}
```

VS Code automatically publishes contributed colors as CSS custom properties in the extension's webviews (e.g. `--vscode-mergePro-conflict-oursBackground`), so the webview consumes them with no message passing.

## Token list

Six tokens. Defaults are the exact rgba values used in the current codebase.

| Token | Default | Primary use site |
|---|---|---|
| `mergePro.conflict.oursBackground` | `rgba(188,63,60,0.28)` | Ours pane: conflict chunks |
| `mergePro.conflict.theirsBackground` | `rgba(60,100,188,0.28)` | Theirs pane: conflict chunks |
| `mergePro.nonConflicting.oursBackground` | `rgba(98,178,98,0.15)` | Ours pane: non-conflicting auto-merge chunks |
| `mergePro.nonConflicting.theirsBackground` | `rgba(197,134,192,0.15)` | Theirs pane: non-conflicting auto-merge chunks |
| `mergePro.result.unresolvedBackground` | `rgba(160,100,40,0.18)` | Result pane: chunks pending a decision |
| `mergePro.resolved.background` | `rgba(78,201,176,0.12)` | Any pane: resolved chunks |

The slightly-different alpha variants currently used in the gutter band overlays (`0.22` for the chunk fill, vs `0.28` for the in-pane background) are unified onto the same six tokens. A small reduction in visual variety, gained in exchange for one knob per state.

**Borders are out of scope for v1.** Left/right pane borders on conflict rows (e.g. `rgba(220,80,70,0.6)`) and empty-range top/bottom borders keep their current hardcoded rgba values. Reasons: their colors are a brighter shade of the background base (different hue, not just different alpha), so deriving them from a single user-chosen background would either look wrong or require a separate alpha/lightness scheme. Adding border tokens later is a non-breaking addition.

## Implementation outline

1. **`package.json`** — add a `contributes.colors` array with six entries, each with `id`, `description`, and `defaults: { dark, light, highContrast }` blocks. All three default variants use the same rgba value for now (the current UI ships dark-only). Future themes can refine.

2. **Webview CSS** — replace hardcoded rgba literals with `var(--vscode-mergePro-...)` lookups, each with the current rgba as a CSS fallback so a missed token never produces an invisible chunk. Files affected:
   - `webview/editor/ThreePaneEditor.tsx` — the embedded `<style>` block defining `.merge-ours-*`, `.merge-theirs-*`, `.merge-result-*` background classes. Eight class backgrounds map to six tokens (the three `*-resolved` classes share `mergePro.resolved.background`). The `.merge-empty-*` border classes and the conflict-row `border-left`/`border-right` declarations are left untouched per the borders-out-of-scope decision above.
   - `webview/editor/GutterConnector.tsx` — the `FILL_CONFLICT`, `FILL_NONCONFLICT`, `FILL_RESOLVED`, `FILL_PARTIAL` module constants. These render to SVG `fill` attributes; switch to reading the CSS var via `getComputedStyle(document.documentElement)` at render time, or via a small helper that maps a chunk state to a CSS var name.
   - `webview/editor/ChunkBandLayer.tsx` — same `FILL_*` constants as above; same treatment.

3. **README** — add a short "Customizing colors" subsection under Configuration showing the `workbench.colorCustomizations` snippet and listing the six tokens.

4. **No backend / extension-host changes** — colors are purely a webview rendering concern. Nothing in `src/` is touched.

## Trade-offs and decisions

- **Tokens vs configuration:** chose `contributes.colors` over `contributes.configuration` because it integrates with per-theme overrides and the existing `var(--vscode-...)` pattern already in use in `webview/panel/FileItem.tsx` and `webview/panel/SessionHeader.tsx`. Configuration settings (hex string fields) would have given simpler discoverability but flattened per-theme behavior and forced a separate code path.
- **Six tokens vs three or twelve:** six matches what the eye already sees (Ours red, Theirs blue, Ours green, Theirs purple, Result brown, Resolved teal). Three would have lost the Ours/Theirs side distinction. Twelve would have multiplied surface area for marginal control.
- **Token alpha embedded:** keeping alpha in the token value (rather than alpha-less tokens + CSS opacity) keeps the model simple — one token, one final color. Cost: the gutter-band overlays lose their slightly-lighter alpha variant.
- **SVG fills via getComputedStyle:** SVG `fill` attributes can't reference CSS vars directly in all rendering contexts; reading them via `getComputedStyle` on the document element at render time is the simplest reliable approach. The cost is recomputing on each render — negligible for the small number of chunks per file.

## Backwards compatibility

Zero impact. Defaults are byte-identical to current rgba values; users who upgrade without touching settings see no visual change. The contribution is additive — no existing keys move, no migrations.

## Testing

- **Manual:** install the dev build, open a file with conflicts, confirm colors match the current main branch visually. Then add a `workbench.colorCustomizations` override for one token and confirm only that color changes.
- **Automated:** existing unit tests cover decoration assignment, not color values. No new tests for color tokens specifically — VS Code's `contributes.colors` is well-trodden territory and the change is a static-substitution refactor.

## Risks

- **SVG `fill` reading via `getComputedStyle`** is the only mildly non-trivial bit. If the CSS var isn't yet defined when the SVG first renders (e.g. during a brief window before VS Code injects its theme vars into the webview), the fallback rgba kicks in via a small helper that parses the var output. If empty, fall back to the hardcoded current default. This means a user *could* see the default color flash briefly on first paint — acceptable.
- **Theme authors** may eventually want to theme these tokens. The default block already includes `light` and `highContrast` slots so refining defaults later is a one-line change per token, not a breaking move.
