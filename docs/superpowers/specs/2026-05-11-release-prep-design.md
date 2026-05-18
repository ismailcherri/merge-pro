# MergePro v0.1 Release Prep — Design

**Date:** 2026-05-11
**Status:** Approved (brainstorming phase)
**Author:** Ismail Cherri (with Claude)

## Goal

Prepare the MergePro repository for its initial public release as a VS Code extension. Land manifest fixes, contributor docs, CI polish, and code hardening in one coherent pass, then publish `v0.1.0` to the VS Code Marketplace, Open VSX, and GitHub Releases.

## Non-goals

- Designing a real icon (placeholder for v0.1).
- Marketplace screenshots / animated demos (captured during rollout, not blocking).
- Localization (`package.nls.json`).
- Telemetry plumbing (extension has none yet).
- Settings/configuration contributions (none defined yet).

## Approach

Four workstreams, one PR (split only if the CSP audit balloons):

1. Manifest & branding
2. Docs (human + AI contributor)
3. CI & release automation
4. Code hardening (activation, CSP, engine pin)

## Deliverables

### 1. Manifest & branding — `package.json`

Final shape:

```jsonc
{
    "name": "merge-pro",
    "displayName": "MergePro",
    "description": "IntelliJ-style three-pane merge conflict resolver for VS Code.",
    "version": "0.1.0",
    "publisher": "ismailcherri",
    "license": "MIT",
    "icon": "assets/icon.png",
    "repository": {
        "type": "git",
        "url": "https://github.com/ismailcherri/merge-pro.git",
    },
    "bugs": { "url": "https://github.com/ismailcherri/merge-pro/issues" },
    "homepage": "https://github.com/ismailcherri/merge-pro#readme",
    "qna": "marketplace",
    "galleryBanner": { "color": "#3C2F2F", "theme": "dark" },
    "engines": { "vscode": "^1.85.0", "node": ">=20.0.0" },
    "categories": ["SCM Providers", "Other"],
    "keywords": [
        "git",
        "merge",
        "conflict",
        "diff",
        "three-way",
        "intellij",
        "resolve",
        "merge-tool",
        "vcs",
    ],
}
```

Changes from current `package.json`:

- `publisher` → `ismailcherri` (was placeholder).
- `repository.url` → `https://github.com/ismailcherri/merge-pro.git`.
- Added: `license`, `icon`, `bugs`, `homepage`, `qna`, `galleryBanner`.
- `engines.node` pinned to `>=20.0.0` (matches CI).
- `categories` → `["SCM Providers", "Other"]`.
- `keywords` expanded.
- **`activationEvents` removed entirely.** SCM webview view + declared commands auto-activate in VS Code ≥1.74; explicit `onStartupFinished` is redundant and slows startup.

New file: `assets/icon.png` — 128×128 placeholder. Solid background using `#3C2F2F` (brown from MergePro color language) with "MP" wordmark. Marked TODO in README for later replacement.

`.vscodeignore` audit: verify `assets/` is **not** excluded (icon must ship). Current patterns (`.vscode/**`, `src/**`, `webview/**`, etc.) are correct; add `assets/icon.png` exception if needed.

### 2. Docs

#### `README.md` (full rewrite)

Section order:

1. Hero: title, one-line tagline, badges (marketplace version, installs, CI status, license).
2. Screenshot / GIF placeholder block (`<!-- TODO: screenshots before publish -->`).
3. **Features** (expanded from current bullets).
4. **Install** — three install paths:
    - VS Code Marketplace (`code --install-extension ismailcherri.merge-pro`).
    - Open VSX (Cursor, VSCodium, Windsurf, code-server).
    - Sideload `.vsix` from GitHub Releases.
5. **Usage** — step-by-step with screenshot TODOs.
6. **Keybindings** — table of `Alt+↑` / `Alt+↓` and any future bindings.
7. **Configuration** — placeholder "no settings yet" section.
8. **Development** — clone, `npm install`, `F5` to launch Extension Development Host, `npm test`, `npm run lint`.
9. **Contributing** — one paragraph linking `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md`.
10. **License** — MIT.

#### `CONTRIBUTING.md` (new)

- Dev environment: Node ≥20, VS Code ≥1.85.
- Repo layout:
    - `src/` — extension host (TypeScript, runs in Node).
    - `webview/` — React panes (panel + editor), built with Vite.
    - `src/protocol.ts` — message contract between host and webview.
    - `test/` — integration tests via `@vscode/test-electron`.
    - `test-fixtures/` — fixture repos with real merge conflicts.
    - `docs/superpowers/specs/` — design docs.
    - `docs/superpowers/plans/` — implementation plans.
- Workflow: clone → `npm install` → `F5` in VS Code to launch.
- Commands: `npm run build`, `npm test`, `npm run test:watch`, `npm run test:integration`, `npm run lint`, `npm run format`.
- Commit conventions: prefer Conventional Commits (`feat:`, `fix:`, `chore:`) matching existing history.
- PR conventions: link issue, include test plan, include screenshots for UI changes.
- Release process pointer: maintainer-only; bump version, update CHANGELOG, tag `vX.Y.Z`, push tag; `release.yml` does the rest.

#### `CODE_OF_CONDUCT.md` (new)

Contributor Covenant v2.1 verbatim. Enforcement contact: `ismailcherri@gmail.com`.

#### `AGENTS.md` (new, repo root)

AI-contributor doc. Cross-tool standard (Claude Code, Cursor, Copilot, Codex, Aider all read it). Sections:

- **Architecture map** — extension host (`src/`) ↔ webview (`webview/`) via typed messages in `src/protocol.ts`. `MergeEditorProvider` / `MergePanelProvider` host the webviews; `MergeSessionManager` owns conflict state; `GitService` wraps git CLI.
- **Build & test commands** — verbatim from `package.json` scripts.
- **Code conventions** — Prettier config is source of truth (`.prettierrc`). Default to no comments; explain _why_ only when non-obvious. File-size signal: when a file grows past ~300 lines or mixes concerns, split.
- **How to add a feature** — pointer to existing specs in `docs/superpowers/specs/` as worked examples; follow the brainstorm → spec → plan → implement flow.
- **Do not commit** — `out/`, `*.vsix`, `node_modules/`, `test-fixtures/conflict-repo/repo/`.

#### `.github/ISSUE_TEMPLATE/bug_report.yml` + `feature_request.yml` (new)

GitHub structured issue forms. Bug report fields: VS Code version, MergePro version, OS, repro steps, expected, actual, screenshots. Feature request fields: problem statement, proposed solution, alternatives considered.

#### `.github/PULL_REQUEST_TEMPLATE.md` (new)

Summary / Test plan checklist / Screenshots-if-UI / Related issue.

#### `CHANGELOG.md` (reformat)

Switch to Keep-a-Changelog format. Add `## [Unreleased]` section. Existing entries become `## [0.1.0] - 2026-05-11`.

### 3. CI & release automation

#### `.github/workflows/ci.yml` (modify)

Add steps to existing job (keep ubuntu-only — extension is pure JS, no native binaries):

- After `npm ci`: `npm run lint`.
- After build: `xvfb-run -a npm run test:integration` (integration suite currently builds but never runs in CI).
- Keep the existing `npx vsce package --no-dependencies` dry-run as the final step.

#### `.github/workflows/release.yml` (new)

Triggers:

- `push` of tags matching `v*.*.*`.
- `workflow_dispatch` with `dry_run: boolean` input.

Job: ubuntu-latest, Node 20. Steps:

1. `actions/checkout@v4`.
2. `actions/setup-node@v4` with `node-version: 20`, `cache: npm`.
3. `npm ci`.
4. `npm run lint`.
5. `npm test`.
6. `npm run build`.
7. `npx vsce package --no-dependencies` → produces `merge-pro-<version>.vsix`.
8. If not dry-run: `npx vsce publish --packagePath *.vsix --pat ${{ secrets.VSCE_PAT }}`.
9. If not dry-run: `npx ovsx publish *.vsix --pat ${{ secrets.OVSX_PAT }}`.
10. If not dry-run: `softprops/action-gh-release@v2` to create a GitHub Release on the tag, attach the `.vsix`, auto-generate release notes from commit history.

**Required secrets** (documented in `CONTRIBUTING.md` release section):

- `VSCE_PAT` — Azure DevOps PAT scoped to _Marketplace > Manage_, for the `ismailcherri` publisher.
- `OVSX_PAT` — open-vsx.org access token for the `ismailcherri` namespace.

### 4. Code hardening

#### Activation events

Remove `activationEvents` from `package.json` (covered in §1). No code change in `src/extension.ts` required — `activate()` will be called the first time a contributed command runs or the SCM webview view is shown.

#### CSP audit

Read `src/providers/MergeEditorProvider.ts` and `src/providers/MergePanelProvider.ts`. For each webview HTML output, verify:

- A `nonce` is generated per webview load.
- The CSP `<meta>` tag has shape:
    ```
    default-src 'none';
    img-src ${webview.cspSource} https: data:;
    script-src 'nonce-${nonce}';
    style-src ${webview.cspSource} 'unsafe-inline';
    font-src ${webview.cspSource};
    ```
- `webview.options = { enableScripts: true, localResourceRoots: [extensionUri] }` (no broader root).
- All `<script>` tags carry `nonce="${nonce}"`.

**Fix budget:** if remediation is <50 lines total, roll into this PR. If larger, ship a documented known issue and split into a follow-up spec.

#### `.vscode/extensions.json` (new)

```json
{ "recommendations": ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"] }
```

#### `.vscode/tasks.json` (new)

Provide the `npm: build` task referenced by `launch.json` so `F5` works on a fresh clone without manual task configuration.

## Testing

- **Packaging:** `npx vsce package --no-dependencies` succeeds with zero warnings. `npx vsce ls` shows expected file list (includes `out/`, `assets/icon.png`, `README.md`, `LICENSE`, `CHANGELOG.md`; excludes `src/`, `test/`, `node_modules/`, `webview/`).
- **CSP:** F5 launch, open merge editor on a `test-fixtures/` fixture, open Webview Developer Tools, confirm zero CSP violations in console. No automated test.
- **CI:** verify on a PR branch that lint, unit, integration (xvfb), build, and packaging all execute. Look for `test-electron` startup log in integration step.
- **Release workflow:** run via `workflow_dispatch` with `dry_run: true` before tagging. Confirm packaging step succeeds and publish steps are skipped.
- **Docs:** render README on GitHub preview, click every link, confirm anchors. Marketplace/installs badges will 404 until first publish — acceptable.

## Rollout

1. Land all four workstreams in one PR; merge to `main`.
2. Register `ismailcherri` publisher on Azure DevOps Marketplace. Register `ismailcherri` namespace on open-vsx.org. Generate `VSCE_PAT` and `OVSX_PAT`; add as GitHub repo secrets.
3. Run `release.yml` via `workflow_dispatch` with `dry_run: true`. Fix any failures.
4. Bump `version` to `0.1.0` in `package.json` (already there), finalize `CHANGELOG.md`, commit, tag `v0.1.0`, push tag.
5. Release workflow publishes to both marketplaces and creates the GitHub Release.
6. Smoke test: install in clean VS Code and clean Cursor, walk through README usage on a real conflict.

## Risks & mitigations

- **CSP audit surfaces real issues.** Fix budget <50 lines → in-PR. Larger → split, ship v0.1 with documented known issue.
- **vsce rejects the package.** CI dry-run packaging step catches this pre-tag.
- **Open VSX namespace `ismailcherri` taken.** Verify during rollout step 2; fallback to `merge-pro` namespace if needed.
- **Removing `activationEvents` regresses something.** Manual F5 smoke test confirms SCM view + commands still work. The implicit-activation behavior is stable since VS Code 1.74; we require ≥1.85.
- **Placeholder icon looks unprofessional.** Acceptable for v0.1; listing can be updated post-publish without re-versioning the extension.

## Open questions

None — all decisions resolved during brainstorming.
