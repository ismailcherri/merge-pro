# MergePro — VSCode Extension Design Spec

**Date:** 2026-05-06
**Status:** Approved

## Overview

MergePro is a VSCode extension for resolving Git merge conflicts. It provides a dedicated SCM sidebar panel that lists all conflicted files with progress tracking, and a custom three-pane merge editor (inspired by IntelliJ IDEA) with IntelliJ-style SVG polygon connectors between panes, per-chunk accept/reject actions, and batch resolution operations.

The extension targets the VSCode Marketplace.

---

## Goals

- Replace the cognitive overhead of VSCode's native merge editor with a clearer visual language: green for non-conflicting changes, brown for true conflicts, gray for unresolved zones.
- Give users a high-level view of merge progress (how many files, how many chunks remain) without leaving the editor.
- Ship in focused, independently releasable sprints — one sprint per layer.

## Non-Goals (v1)

- AI-assisted resolution (architecture must leave room for it; implementation deferred).
- Git operation shortcuts (abort merge, continue merge) — deferred to backlog.
- Session summary panel — deferred to backlog.

---

## Architecture

Three layers. Each layer has a single responsibility and communicates with adjacent layers through a well-defined interface.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1 — Extension Host (Node.js)                     │
│  GitService · MergeSessionManager · ConflictParser      │
│  Owns all state, git access, and business logic         │
└────────────────┬────────────────────────────────────────┘
                 │ postMessage (typed protocol)
    ┌────────────┴────────────┐
    │                         │
┌───▼──────────────┐   ┌──────▼──────────────────────────┐
│ Layer 2          │   │ Layer 3                          │
│ SCM Panel        │   │ Three-Pane Merge Editor          │
│ (WebviewView)    │   │ (WebviewPanel)                   │
│ React sidebar    │   │ React + Monaco + SVG connectors  │
│ Pure view layer  │   │ Pure view layer                  │
└──────────────────┘   └──────────────────────────────────┘
```

**Key constraint:** No git logic or VSCode API calls live in the webview layers. All state flows from Layer 1 → Layer 2/3 via messages. User actions flow Layer 2/3 → Layer 1 as command messages.

---

## Data Flow

1. User performs a `git merge` that creates conflicts.
2. `GitService` detects the change via `repo.state.onDidChange` — `repo.state.mergeChanges` now contains the conflicted file list.
3. `MergeSessionManager` builds session state: per-file conflict counts via `ConflictParser`.
4. `MergePanelProvider` pushes a `stateUpdate` message to the SCM panel webview.
5. SCM panel renders the grouped file list (Conflicts / Resolved sections).
6. User clicks **Resolve** on a file → panel sends `openEditor` command → `MergeEditorProvider` opens the three-pane editor as a new tab.
7. Editor webview renders three Monaco instances (ours / result / theirs) with SVG gutter connectors.
8. User resolves chunks → editor sends `chunkResolved` commands → `MergeSessionManager` updates state → SCM panel progress updates in real time.

---

## Sprint Plan

Each sprint is independently deliverable and reviewable. Later sprints depend on earlier ones but do not require them to be "polished" — they only require the interfaces to be stable.

---

### Sprint 1 — Extension Host Core

**Goal:** Lay the foundation. No UI. All logic, all state, all git wiring.

**Deliverables:**

- `GitService.ts` — wraps `vscode.git` extension API. Exposes:
    - `getMergeChanges(): MergeChange[]` — current list of conflicted files
    - `onDidMergeStateChange: Event<MergeChange[]>` — fires on every state update
    - `getFileContents(uri, stage: 1|2|3): Promise<string>` — retrieves base/ours/theirs via git index URI scheme
- `ConflictParser.ts` — pure function, no VSCode dependencies:
    - `parse(oursText: string, baseText: string, theirsText: string): ConflictChunk[]`
    - Requires all three versions because distinguishing non-conflicting (green) chunks from true conflict (brown) chunks requires diffing each side against base independently — the working tree conflict markers alone only reveal true conflicts.
    - Each `ConflictChunk` has: `type: 'non-conflicting' | 'conflict'`, `oursLines`, `theirsLines`, `baseStartLine`, `baseEndLine`, `resolved: boolean`
- `MergeSessionManager.ts` — owns session state:
    - Holds `Map<filePath, FileConflictState>` (total chunks, resolved chunks)
    - Listens to `GitService.onDidMergeStateChange` and `workspace.onDidChangeTextDocument`
    - Re-parses affected file on document change; emits `onDidSessionUpdate`
- `extension.ts` — activates on `onStartupFinished`; wires all services together; registers placeholder commands.

**Interfaces established at end of sprint:**

```ts
interface MergeChange {
    uri: Uri
    fileName: string
}
interface ConflictChunk {
    type: 'non-conflicting' | 'conflict'
    oursLines: string[]
    theirsLines: string[]
    baseStartLine: number
    baseEndLine: number
    resolved: boolean
}
interface FileConflictState {
    uri: Uri
    totalChunks: number
    resolvedChunks: number
}
interface SessionState {
    files: FileConflictState[]
}
```

**Tests:** Full unit test coverage for `ConflictParser` (all edge cases: empty file, no conflicts, nested markers, Windows line endings). `MergeSessionManager` state transition tests with a mocked `GitService`.

**Definition of done:** `MergeSessionManager.onDidSessionUpdate` fires correctly when a file with conflicts is opened and modified. All `ConflictParser` unit tests pass.

---

### Sprint 2 — SCM Sidebar Panel

**Goal:** The grouped file list panel in the Source Control sidebar. No merge editor yet — clicking Resolve is a no-op placeholder.

**Deliverables:**

- `MergePanelProvider.ts` — implements `WebviewViewProvider`. Registered as a view in the `scm` container.
    - On `onDidSessionUpdate`, serializes `SessionState` and posts `{ type: 'stateUpdate', state }` to the webview.
    - Handles incoming messages: `{ type: 'openEditor', uri }` (no-op in this sprint).
- `webview/panel/` — React app (bundled via webpack):
    - `SessionHeader` — "MERGE IN PROGRESS · N of M files resolved" + full progress bar.
    - `BatchActionsBar` — "Accept All Ours / Accept All Theirs / Auto-Resolve" buttons (send commands to host; host applies them in Sprint 3).
    - `FileList` — two sections: **CONFLICTS** and **RESOLVED**.
    - `FileItem` — filename, per-file progress bar (`resolvedChunks / totalChunks`), conflict count badge, **Resolve** button. Active file (currently open in editor) highlighted with a left border accent.
- `package.json` contribution: view declared in `contributes.views.scm`.

**Message protocol (panel ↔ host):**

```ts
// host → webview
{
    type: 'stateUpdate'
    state: SessionState
}

// webview → host
{
    type: 'openEditor'
    uri: string
}
{
    type: 'batchAccept'
    uri: string
    side: 'ours' | 'theirs'
}
{
    type: 'autoResolve'
    uri: string
}
```

**Tests:** React component tests with Vitest + jsdom. `SessionHeader`, `FileList`, `FileItem` render correctly for all state combinations (empty, all conflicted, partially resolved, all resolved).

**Definition of done:** Panel appears in the SCM sidebar during an active merge. File list updates in real time as files are resolved externally. Resolve button visible (click is a no-op).

---

### Sprint 3 — Three-Pane Merge Editor

**Goal:** The core visual experience. Full IntelliJ-style editor with SVG connectors, per-chunk actions, batch operations, and conflict navigation.

**Deliverables:**

- `MergeEditorProvider.ts` — creates a `WebviewPanel` tab when `openEditor` is received.
    - Reads ours/theirs content via `GitService.getFileContents`.
    - Reads working tree (result) via `workspace.fs.readFile`.
    - Passes all three versions + parsed chunks to the webview.
    - Handles chunk resolution commands: writes the resolved result back to the working tree file.
- `webview/editor/` — React app with Monaco:
    - `ThreePaneEditor.tsx` — top-level layout: toolbar + three `EditorPane` instances + two `GutterConnector` instances.
    - `EditorPane.tsx` — wraps a single Monaco editor instance. Left and right panes are read-only; center (result) is editable.
    - `GutterConnector.tsx` — SVG canvas between each pair of panes. On every scroll event and on initial load, queries `editor.getTopForLineNumber()` from adjacent Monaco instances to compute y-coordinates for each chunk, then renders polygon shapes:
        - Rectangle when chunk heights match on both sides.
        - Trapezoid when heights differ (e.g., one pane has a placeholder blank line).
    - Color language:
        - **Green** — non-conflicting change (only one side modified this region)
        - **Brown/orange** — true conflict (both sides changed this region)
        - **Teal** — resolved chunk (accepted into result)
        - **Gray** — unresolved placeholder in result pane
        - **Dark** — absent line placeholder (line exists only on the other side)
    - Per-chunk inline actions (rendered as Monaco decorations with hover widgets):
        - Left pane: `✕` (ignore) and `>>` (accept into result)
        - Right pane: `<<` (accept into result) and `✕` (ignore)
    - Toolbar: **↑ Prev** / **Conflict N of M** / **Next ↓** navigation · **Accept All Ours** · **Accept All Theirs** · **Auto-Resolve Non-Conflicting** · **Save & Next File**.
    - Synchronized scrolling: all three editors share scroll position via `editor.onDidScrollChange`.
- `ConflictResolver.ts` (extension host utility) — applies chunk decisions to produce the resolved file text. Pure function — takes original text + array of `{chunk, decision}` and returns resolved string.

**Tests:** `ConflictResolver` fully unit-tested. `GutterConnector` SVG output snapshot-tested with mocked line-height data. Manual testing against the `test-fixtures/` repo.

**Definition of done:** Opening a conflicted file via the panel shows the three-pane editor. SVG connectors render and update on scroll. Accepting/rejecting a chunk updates the result pane and the SCM panel progress bar.

---

### Sprint 4 — Integration, Error Handling & Marketplace Polish

**Goal:** Wire all layers together end-to-end, harden edge cases, and prepare for marketplace publication.

**Deliverables:**

- End-to-end flow: git merge → panel appears → Resolve → editor opens → all chunks resolved → panel marks file as resolved → all files resolved → panel shows completion state.
- `batchAccept` and `autoResolve` commands fully wired (Sprint 2 buttons become functional).
- Error states:
    - No git repo: panel shows "No Git repository detected."
    - Git extension unavailable: one-time notification; extension retries on `onDidChange`.
    - Merge aborted externally: `MergeSessionManager` clears state; panel resets.
    - File saved with unresolved markers: warning badge on file in panel.
    - Monaco fails to load: fallback "Open in VS Code's default merge editor" link.
- `test-fixtures/` — pre-baked git repo with two branches producing known conflicts across 3 files (TypeScript, JSON, Markdown). Used for manual regression testing.
- Integration tests using `@vscode/test-electron`: trigger conflict in test fixture, assert panel renders correct file count, resolve one file, assert panel updates.
- Marketplace assets: `README.md`, extension icon (256×256 PNG), `CHANGELOG.md`, `LICENSE`, demo GIF in README.
- `package.json` metadata: `publisher`, `categories`, `keywords`, `engines.vscode` (minimum 1.85.0 — when merge editor APIs stabilized).
- CI: GitHub Actions workflow — lint, unit tests, integration tests, `vsce package`.

**Definition of done:** `vsce package` produces a `.vsix` with no warnings. Extension installs cleanly on VSCode 1.85+ on macOS, Windows, and Linux. All integration tests pass in CI.

---

## Project Structure

```
merge-pro/
├── .github/workflows/ci.yml
├── package.json
├── tsconfig.json
├── webpack.config.js           (two entry points: panel + editor)
├── src/
│   ├── extension.ts
│   ├── services/
│   │   ├── GitService.ts
│   │   └── MergeSessionManager.ts
│   ├── providers/
│   │   ├── MergePanelProvider.ts
│   │   └── MergeEditorProvider.ts
│   ├── parsers/
│   │   └── ConflictParser.ts
│   └── utils/
│       ├── ConflictResolver.ts
│       └── gitUriUtils.ts
├── webview/
│   ├── panel/
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── SessionHeader.tsx
│   │   ├── FileList.tsx
│   │   ├── FileItem.tsx
│   │   └── BatchActionsBar.tsx
│   └── editor/
│       ├── index.tsx
│       ├── App.tsx
│       ├── ThreePaneEditor.tsx
│       ├── EditorPane.tsx
│       └── GutterConnector.tsx
├── test/
│   ├── unit/
│   └── integration/
└── test-fixtures/
    └── conflict-repo/          (pre-baked git repo for manual + integration tests)
```

---

## AI Integration Point (Future)

The architecture intentionally leaves a clean hook for AI-assisted resolution in a future sprint:

- `MergeEditorProvider` will pass chunk data to an AI service and receive a `suggestedResolution: string` per chunk.
- The editor webview will render AI suggestions as a fourth option alongside "Accept Ours / Accept Theirs / Edit Manually."
- No changes to `ConflictParser`, `MergeSessionManager`, `GutterConnector`, or the SCM panel are required.

---

## Key Dependencies

| Package                 | Purpose                                  |
| ----------------------- | ---------------------------------------- |
| `monaco-editor`         | Standalone Monaco for the editor webview |
| `react`, `react-dom`    | Both webview UIs                         |
| `@types/vscode`         | Extension host types                     |
| `@vscode/test-electron` | Integration test runner                  |
| `webpack`, `ts-loader`  | Webview bundling                         |
| `vitest`, `jsdom`       | React component unit tests               |
| `@vscode/vsce`          | Marketplace packaging                    |
