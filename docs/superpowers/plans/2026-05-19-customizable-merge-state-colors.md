# Customizable Merge State Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose MergePro's six chunk-state highlight colors as VS Code color tokens so users can override them via `workbench.colorCustomizations`, with defaults that exactly preserve current visuals.

**Architecture:** Add `contributes.colors` to `package.json` with six tokens. Inside the webview, replace the hardcoded `rgba(...)` literals with `var(--vscode-mergePro-...)` references that include the current rgba as a CSS fallback. SVG fills use the same CSS-var-via-inline-style trick — no JS helper required. Borders stay hardcoded per the spec.

**Tech Stack:** VS Code extension API (`contributes.colors`), TypeScript/React webview, plain CSS custom properties.

**Spec:** `docs/superpowers/specs/2026-05-19-customizable-merge-state-colors-design.md`

---

## File Structure

| File | Role |
|---|---|
| `package.json` | Declare the six `contributes.colors` entries with defaults |
| `webview/editor/chunkColors.ts` | **New.** Single source of truth for the CSS-var-with-fallback strings used by SVG fills |
| `webview/editor/ThreePaneEditor.tsx` | Replace eight `rgba(...)` background literals in the embedded `<style>` block |
| `webview/editor/GutterConnector.tsx` | Replace `FILL_*` constants with imports from `chunkColors.ts` |
| `webview/editor/ChunkBandLayer.tsx` | Replace `FILL_*` constants with imports from `chunkColors.ts` |
| `README.md` | Add "Customizing colors" subsection under Configuration |

Each task ends with a commit. The webview is bundled with Vite, so verifying a task means running `npm run build` and visually checking — there are no automated color tests by design.

---

## Task 1: Declare the six color tokens in `package.json`

**Files:**
- Modify: `package.json` — add `contributes.colors` array

- [ ] **Step 1: Locate the `contributes` block in `package.json`**

Open `package.json` and find the `"contributes"` object. It currently has keys like `commands`, `viewsContainers`, `views`, `menus`, `configuration` (or similar). The new `colors` array will become a sibling key.

- [ ] **Step 2: Add the `colors` array**

Insert the following key inside `"contributes"` (order among siblings doesn't matter):

```json
"colors": [
    {
        "id": "mergePro.conflict.oursBackground",
        "description": "Background highlight for unresolved conflict chunks on the Ours pane.",
        "defaults": {
            "dark": "#bc3f3c47",
            "light": "#bc3f3c47",
            "highContrast": "#bc3f3c47"
        }
    },
    {
        "id": "mergePro.conflict.theirsBackground",
        "description": "Background highlight for unresolved conflict chunks on the Theirs pane.",
        "defaults": {
            "dark": "#3c64bc47",
            "light": "#3c64bc47",
            "highContrast": "#3c64bc47"
        }
    },
    {
        "id": "mergePro.nonConflicting.oursBackground",
        "description": "Background highlight for non-conflicting auto-merged chunks on the Ours pane.",
        "defaults": {
            "dark": "#62b26226",
            "light": "#62b26226",
            "highContrast": "#62b26226"
        }
    },
    {
        "id": "mergePro.nonConflicting.theirsBackground",
        "description": "Background highlight for non-conflicting auto-merged chunks on the Theirs pane.",
        "defaults": {
            "dark": "#c586c026",
            "light": "#c586c026",
            "highContrast": "#c586c026"
        }
    },
    {
        "id": "mergePro.result.unresolvedBackground",
        "description": "Background highlight for chunks awaiting a decision in the Result pane.",
        "defaults": {
            "dark": "#a0642e2e",
            "light": "#a0642e2e",
            "highContrast": "#a0642e2e"
        }
    },
    {
        "id": "mergePro.resolved.background",
        "description": "Background highlight for resolved chunks in any pane.",
        "defaults": {
            "dark": "#4ec9b01f",
            "light": "#4ec9b01f",
            "highContrast": "#4ec9b01f"
        }
    }
]
```

The hex+alpha values are the exact rgba defaults converted to `#RRGGBBAA`:

| rgba | #RRGGBBAA |
|---|---|
| `rgba(188,63,60,0.28)` | `#bc3f3c47` |
| `rgba(60,100,188,0.28)` | `#3c64bc47` |
| `rgba(98,178,98,0.15)` | `#62b26226` |
| `rgba(197,134,192,0.15)` | `#c586c026` |
| `rgba(160,100,40,0.18)` | `#a0642e2e` |
| `rgba(78,201,176,0.12)` | `#4ec9b01f` |

VS Code requires `#RRGGBBAA` (not `rgba(...)`) inside `defaults`.

- [ ] **Step 3: Validate the manifest**

Run: `npx vsce ls --no-yarn 2>&1 | head -5`
Expected: no errors. (Alternatively `node -e "JSON.parse(require('fs').readFileSync('package.json'))"` to just verify JSON well-formedness.)

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat: declare mergePro.* color tokens with current defaults"
```

---

## Task 2: Create `webview/editor/chunkColors.ts`

**Files:**
- Create: `webview/editor/chunkColors.ts`

This module is the single source of truth for the four CSS-var-with-fallback strings used by SVG fills in `GutterConnector` and `ChunkBandLayer`. Keeping them in one file prevents the two consumers from drifting.

- [ ] **Step 1: Create the file**

Create `webview/editor/chunkColors.ts` with this exact content:

```ts
// CSS custom-property references for the merge-state chunk colors used by SVG
// fills (gutter connector, chunk-band overlay). Each value includes a fallback
// rgba literal that matches the default registered in `package.json`'s
// `contributes.colors`, so the UI degrades gracefully if VS Code has not
// injected the token (e.g. during the brief first paint).
//
// In-pane backgrounds live in the <style> block in ThreePaneEditor.tsx and
// reference the same tokens directly via var(...) in CSS — they do not import
// from this module.

export const CHUNK_FILL = {
    /** Unresolved conflict — uses the Ours-side conflict color. */
    conflict:
        'var(--vscode-mergePro-conflict-oursBackground, rgba(188,63,60,0.28))',
    /** Non-conflicting auto-mergeable chunk — uses the Ours-side color. */
    nonConflicting:
        'var(--vscode-mergePro-nonConflicting-oursBackground, rgba(98,178,98,0.15))',
    /** Resolved chunk — shared across all panes. */
    resolved:
        'var(--vscode-mergePro-resolved-background, rgba(78,201,176,0.12))',
    /**
     * Partial state (one side decided, the other not). Renders with the same
     * token as `conflict`; visual distinction from the full-conflict state is
     * intentionally dropped in v1 to keep token count low.
     */
    partial:
        'var(--vscode-mergePro-conflict-oursBackground, rgba(188,63,60,0.28))',
} as const

export type ChunkFillKey = keyof typeof CHUNK_FILL
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p webview/tsconfig.json`
Expected: `TypeScript: No errors found`

- [ ] **Step 3: Commit**

```bash
git add webview/editor/chunkColors.ts
git commit -m "feat: add shared CHUNK_FILL constants for SVG chunk colors"
```

---

## Task 3: Wire color tokens into `ThreePaneEditor.tsx`

**Files:**
- Modify: `webview/editor/ThreePaneEditor.tsx` — the embedded `<style>` block (around lines 60–82)

- [ ] **Step 1: Locate the `<style>` block**

Run: `grep -n "merge-ours-conflict" /Users/ismailcherri/code/merge-pro/webview/editor/ThreePaneEditor.tsx`

You should see one match around line 64 inside a template-literal `<style>{`...`}</style>` block.

- [ ] **Step 2: Replace the eight background rgba literals**

The current eight CSS rules use rgba backgrounds. Replace each with the matching `var(--vscode-mergePro-...)` reference *and keep the original rgba as a CSS fallback*. The `border-left` / `border-right` / `border-top` / `border-bottom` rules on the same and adjacent lines must NOT be modified — borders are out of scope.

Replace:

```css
.merge-ours-conflict         { background: rgba(188,63,60,0.28); border-left: 2px solid rgba(220,80,70,0.6); }
.merge-ours-nonconflicting   { background: rgba(98,178,98,0.15); }
.merge-ours-resolved         { background: rgba(78,201,176,0.12); }
.merge-theirs-conflict       { background: rgba(60,100,188,0.28); border-right: 2px solid rgba(70,120,220,0.6); }
.merge-theirs-nonconflicting { background: rgba(197,134,192,0.15); }
.merge-theirs-resolved       { background: rgba(78,201,176,0.12); }
.merge-result-unresolved     { background: rgba(160,100,40,0.18); }
.merge-result-resolved       { background: rgba(78,201,176,0.12); }
```

With:

```css
.merge-ours-conflict         { background: var(--vscode-mergePro-conflict-oursBackground, rgba(188,63,60,0.28)); border-left: 2px solid rgba(220,80,70,0.6); }
.merge-ours-nonconflicting   { background: var(--vscode-mergePro-nonConflicting-oursBackground, rgba(98,178,98,0.15)); }
.merge-ours-resolved         { background: var(--vscode-mergePro-resolved-background, rgba(78,201,176,0.12)); }
.merge-theirs-conflict       { background: var(--vscode-mergePro-conflict-theirsBackground, rgba(60,100,188,0.28)); border-right: 2px solid rgba(70,120,220,0.6); }
.merge-theirs-nonconflicting { background: var(--vscode-mergePro-nonConflicting-theirsBackground, rgba(197,134,192,0.15)); }
.merge-theirs-resolved       { background: var(--vscode-mergePro-resolved-background, rgba(78,201,176,0.12)); }
.merge-result-unresolved     { background: var(--vscode-mergePro-result-unresolvedBackground, rgba(160,100,40,0.18)); }
.merge-result-resolved       { background: var(--vscode-mergePro-resolved-background, rgba(78,201,176,0.12)); }
```

Important: the `.merge-empty-*` border rules below this block and the inline `border-left`/`border-right` declarations on `.merge-ours-conflict` and `.merge-theirs-conflict` stay exactly as they are. Do not modify them.

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit -p webview/tsconfig.json`
Expected: `TypeScript: No errors found`

Run: `npm run build`
Expected: build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add webview/editor/ThreePaneEditor.tsx
git commit -m "feat: use mergePro color tokens for chunk backgrounds in panes"
```

---

## Task 4: Wire color tokens into `GutterConnector.tsx`

**Files:**
- Modify: `webview/editor/GutterConnector.tsx` — replace `FILL_*` constants (lines 18–21) and their usages (around line 177–183)

- [ ] **Step 1: Delete the four `FILL_*` constants**

Remove these four lines:

```ts
const FILL_CONFLICT = 'rgba(188,63,60,0.22)'
const FILL_NONCONFLICT = 'rgba(98,178,98,0.18)'
const FILL_RESOLVED = 'rgba(78,201,176,0.18)'
const FILL_PARTIAL = 'rgba(188,63,60,0.12)'
```

- [ ] **Step 2: Add the import**

Near the top of the file, add this import alongside the existing imports:

```ts
import { CHUNK_FILL } from './chunkColors'
```

- [ ] **Step 3: Update the fill selection**

Find this block (around line 177):

```tsx
const fill = v.isResolved
    ? FILL_RESOLVED
    : v.isPartial
      ? FILL_PARTIAL
      : v.isConflict
        ? FILL_CONFLICT
        : FILL_NONCONFLICT
```

Replace with:

```tsx
const fill = v.isResolved
    ? CHUNK_FILL.resolved
    : v.isPartial
      ? CHUNK_FILL.partial
      : v.isConflict
        ? CHUNK_FILL.conflict
        : CHUNK_FILL.nonConflicting
```

- [ ] **Step 4: Move `fill` from attribute into inline style**

Find the `<path>` element below the fill block (around line 184):

```tsx
<path
    key={`chunk-${v.chunkIndex}`}
    ref={(el) => {
        pathRefs.current[v.chunkIndex] = el
    }}
    d=""
    fill={fill}
    style={{ display: 'none' }}
/>
```

Replace with (delete the `fill=` attribute, move it into `style`):

```tsx
<path
    key={`chunk-${v.chunkIndex}`}
    ref={(el) => {
        pathRefs.current[v.chunkIndex] = el
    }}
    d=""
    style={{ display: 'none', fill }}
/>
```

Reason: `fill` as an SVG presentation attribute does not reliably resolve `var(--...)` in every rendering path. CSS variables are reliable inside the `style` property, so we move it there. The imperative `path.style.display = ''` toggle elsewhere in the file is unaffected — it mutates the same `style` object after React commits.

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit -p webview/tsconfig.json`
Expected: `TypeScript: No errors found`

Run: `npm run build`
Expected: build completes without errors.

- [ ] **Step 6: Commit**

```bash
git add webview/editor/GutterConnector.tsx
git commit -m "feat: use mergePro color tokens for gutter connector fills"
```

---

## Task 5: Wire color tokens into `ChunkBandLayer.tsx`

**Files:**
- Modify: `webview/editor/ChunkBandLayer.tsx` — replace `FILL_*` constants (lines 9–12) and their usages (around lines 55–58)

- [ ] **Step 1: Delete the four `FILL_*` constants**

Remove:

```ts
const FILL_CONFLICT = 'rgba(188,63,60,0.22)'
const FILL_NONCONFLICT = 'rgba(98,178,98,0.18)'
const FILL_RESOLVED = 'rgba(78,201,176,0.18)'
const FILL_PARTIAL = 'rgba(188,63,60,0.12)'
```

- [ ] **Step 2: Add the import**

Near the top of the file, add:

```ts
import { CHUNK_FILL } from './chunkColors'
```

- [ ] **Step 3: Update the fill selection**

Find this block (around line 55):

```ts
if (resolved) fill = FILL_RESOLVED
else if (anyDecision) fill = FILL_PARTIAL
else if (c.type === 'conflict') fill = FILL_CONFLICT
else fill = FILL_NONCONFLICT
```

Replace with:

```ts
if (resolved) fill = CHUNK_FILL.resolved
else if (anyDecision) fill = CHUNK_FILL.partial
else if (c.type === 'conflict') fill = CHUNK_FILL.conflict
else fill = CHUNK_FILL.nonConflicting
```

- [ ] **Step 4: Move `fill` from attribute into inline style**

Find the `<rect>` element (around line 130):

```tsx
<rect
    key={`band-${v.chunkIndex}`}
    ref={(el) => {
        bandRefs.current[v.chunkIndex] = el
    }}
    x={0}
    y={0}
    width={width}
    height={0}
    fill={v.fill}
    style={{ display: 'none' }}
/>
```

Replace with (delete the `fill=` attribute, move it into `style`):

```tsx
<rect
    key={`band-${v.chunkIndex}`}
    ref={(el) => {
        bandRefs.current[v.chunkIndex] = el
    }}
    x={0}
    y={0}
    width={width}
    height={0}
    style={{ display: 'none', fill: v.fill }}
/>
```

Same reasoning as Task 4: CSS variables resolve reliably in `style` but not always in the SVG `fill` presentation attribute. The imperative `band.style.display = 'none'` / `''` toggles elsewhere in the file are unaffected.

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit -p webview/tsconfig.json`
Expected: `TypeScript: No errors found`

Run: `npm run build`
Expected: build completes without errors.

- [ ] **Step 6: Commit**

```bash
git add webview/editor/ChunkBandLayer.tsx
git commit -m "feat: use mergePro color tokens for chunk-band layer fills"
```

---

## Task 6: Document customization in `README.md`

**Files:**
- Modify: `README.md` — under the existing `## Configuration` section

- [ ] **Step 1: Locate the Configuration section**

Run: `grep -n "## Configuration" /Users/ismailcherri/code/merge-pro/README.md`

The current section reads:

```markdown
## Configuration

No user-facing settings yet. Future versions may expose color overrides and keybinding customization.
```

- [ ] **Step 2: Replace the section body**

Replace the two-line body above with the following:

````markdown
## Configuration

### Customizing merge state colors

MergePro contributes six color tokens you can override per-theme via `workbench.colorCustomizations` in `settings.json`:

```jsonc
"workbench.colorCustomizations": {
    "mergePro.conflict.oursBackground": "#bc3f3c66",
    "mergePro.conflict.theirsBackground": "#3c64bc66",
    "mergePro.nonConflicting.oursBackground": "#62b26230",
    "mergePro.nonConflicting.theirsBackground": "#c586c030",
    "mergePro.result.unresolvedBackground": "#a0642e40",
    "mergePro.resolved.background": "#4ec9b026"
}
```

| Token | Applies to |
| --- | --- |
| `mergePro.conflict.oursBackground` | Conflict chunks in the **Ours** pane |
| `mergePro.conflict.theirsBackground` | Conflict chunks in the **Theirs** pane |
| `mergePro.nonConflicting.oursBackground` | Auto-mergeable chunks in the **Ours** pane |
| `mergePro.nonConflicting.theirsBackground` | Auto-mergeable chunks in the **Theirs** pane |
| `mergePro.result.unresolvedBackground` | Chunks awaiting a decision in the **Result** pane |
| `mergePro.resolved.background` | Resolved chunks (any pane) |

Use `#RRGGBBAA` to control transparency. Omit any token to keep its default.

Keybinding customization will follow in a later release.
````

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document mergePro color customization tokens"
```

---

## Task 7: End-to-end visual verification

This task runs the extension dev host once with the final state to confirm nothing regressed and override actually works.

- [ ] **Step 1: Build the extension and webview**

Run: `npm run build`
Expected: build completes without errors.

- [ ] **Step 2: Launch the Extension Development Host**

Open the repo in VS Code and press `F5` (or run the "Run Extension" debug configuration). This launches a second VS Code window with the dev build loaded.

- [ ] **Step 3: Verify default visuals**

In the dev host, open a repository that has an in-progress merge with conflicts (or create one). Open the MergePro three-pane editor on a conflicted file. Confirm:
- Conflict rows still show red on the Ours side and blue on the Theirs side.
- Non-conflicting rows still show green (Ours) / purple (Theirs).
- Resolved chunks still show teal.
- The result pane shows brown for unresolved chunks.

Visually, the dev build should be indistinguishable from `main` before this change.

- [ ] **Step 4: Verify an override takes effect**

In the dev host's `settings.json` (User scope), add:

```jsonc
"workbench.colorCustomizations": {
    "mergePro.conflict.oursBackground": "#ff00ff80"
}
```

Reload the merge editor (close and reopen the conflicted file). The Ours-side conflict chunks should now be magenta/pink. Remove the override and reload to confirm defaults come back.

- [ ] **Step 5: No commit (verification only)**

Nothing to commit. If anything looked off, return to the relevant task and fix.

---

## Done

All six color tokens are now user-customizable via `workbench.colorCustomizations`, defaults preserve existing visuals, and documentation directs users to the new tokens. No backend changes, no breaking changes for existing users.
