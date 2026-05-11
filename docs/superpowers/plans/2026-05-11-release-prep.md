# MergePro v0.1 Release Prep Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land manifest fixes, contributor docs, CI/release automation, and code hardening so MergePro v0.1.0 can be published to the VS Code Marketplace, Open VSX, and GitHub Releases.

**Architecture:** Four workstreams in one PR. Manifest changes drive the rest (publisher identity, icon, license, removed activation events). Code hardening fixes a real nonce-entropy issue found during the CSP audit. Docs cover human + AI contributors. CI gains a lint step and a tag-driven release workflow.

**Tech Stack:** TypeScript, VS Code Extension API ^1.85, Vite, React 18, Monaco editor, Vitest, `@vscode/test-electron`, `vsce`, `ovsx`, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-05-11-release-prep-design.md`

---

## File Structure

**Files to create:**

- `assets/icon.png` — 128x128 placeholder icon.
- `AGENTS.md` — AI-contributor doc at repo root.
- `CONTRIBUTING.md` — human contributor doc.
- `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1.
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/workflows/release.yml`
- `.vscode/extensions.json`
- `.vscode/tasks.json`

**Files to modify:**

- `package.json` — manifest fields, remove activationEvents.
- `.vscodeignore` — ensure `assets/` ships, tighten excludes.
- `README.md` — full rewrite.
- `CHANGELOG.md` — Keep-a-Changelog format.
- `.github/workflows/ci.yml` — add lint + integration steps.
- `src/providers/MergePanelProvider.ts` — fix nonce entropy, add style-src.

**File responsibilities:**

- `package.json` owns marketplace metadata and activation policy.
- `assets/` holds shipped binary assets (icon, future screenshots).
- `AGENTS.md` is the entry point for AI tools; `CONTRIBUTING.md` for humans; both link to the existing spec/plan docs in `docs/superpowers/`.
- `.github/workflows/ci.yml` runs on every push/PR; `release.yml` runs only on `v*.*.*` tag pushes (plus a `workflow_dispatch` dry-run path).
- `.vscode/` files exist to make the F5-launch and editor-tooling experience work out of the box on a fresh clone.

---

## Task 1: Update package.json manifest

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read current package.json**

Run: `cat package.json`
Expected: current manifest with publisher `merge-pro-publisher`, no license/icon/bugs/homepage fields, activationEvents = `["onStartupFinished"]`.

- [ ] **Step 2: Apply manifest edits**

Replace the top section of `package.json` (everything before `"scripts"`) with:

```jsonc
{
    "name": "merge-pro",
    "displayName": "MergePro",
    "publisher": "ismailcherri",
    "description": "IntelliJ-style three-pane merge conflict resolver for VS Code.",
    "version": "0.1.0",
    "license": "MIT",
    "icon": "assets/icon.png",
    "repository": {
        "type": "git",
        "url": "https://github.com/ismailcherri/merge-pro.git"
    },
    "bugs": {
        "url": "https://github.com/ismailcherri/merge-pro/issues"
    },
    "homepage": "https://github.com/ismailcherri/merge-pro#readme",
    "qna": "marketplace",
    "galleryBanner": {
        "color": "#3C2F2F",
        "theme": "dark"
    },
    "engines": {
        "vscode": "^1.85.0",
        "node": ">=20.0.0"
    },
    "categories": [
        "SCM Providers",
        "Other"
    ],
    "keywords": [
        "git",
        "merge",
        "conflict",
        "diff",
        "three-way",
        "intellij",
        "resolve",
        "merge-tool",
        "vcs"
    ],
    "main": "./out/extension.js",
    "contributes": {
```

The `activationEvents` array must be removed entirely. The `contributes`, `scripts`, `devDependencies`, and `dependencies` sections stay unchanged.

- [ ] **Step 3: Validate JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"`
Expected: exits 0 with no output.

- [ ] **Step 4: Verify removal of activationEvents**

Run: `grep -c '"activationEvents"' package.json`
Expected: `0`

- [ ] **Step 5: Commit**

```bash
git add package.json
git commit -m "chore: update manifest for v0.1 marketplace release"
```

---

## Task 2: Add placeholder icon

**Files:**
- Create: `assets/icon.png`

- [ ] **Step 1: Create assets directory**

Run: `mkdir -p assets`
Expected: directory created.

- [ ] **Step 2: Generate 128x128 placeholder PNG**

The icon must be a 128x128 PNG. Use ImageMagick if available, otherwise the inline Node script below produces a solid-color PNG using only Node standard library (no dependencies).

Run (if ImageMagick installed):
```bash
convert -size 128x128 xc:'#3C2F2F' -gravity center -fill '#E8D5C4' -font Helvetica-Bold -pointsize 56 -annotate +0+0 'MP' assets/icon.png
```

Otherwise run:
```bash
node -e "
const fs=require('fs'),zlib=require('zlib');
const W=128,H=128;
const data=Buffer.alloc(W*H*3);
for(let i=0;i<data.length;i+=3){data[i]=0x3C;data[i+1]=0x2F;data[i+2]=0x2F;}
const rows=Buffer.alloc(H*(1+W*3));
for(let y=0;y<H;y++){rows[y*(1+W*3)]=0;data.copy(rows,y*(1+W*3)+1,y*W*3,(y+1)*W*3);}
const idat=zlib.deflateSync(rows);
function chunk(type,d){const len=Buffer.alloc(4);len.writeUInt32BE(d.length,0);const tp=Buffer.from(type);const crcBuf=Buffer.concat([tp,d]);const crc=Buffer.alloc(4);crc.writeInt32BE(require('zlib').crc32?require('zlib').crc32(crcBuf):computeCrc(crcBuf),0);return Buffer.concat([len,tp,d,crc]);}
function computeCrc(buf){let c=0xffffffff;for(const b of buf){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^(0xedb88320&-(c&1));}return (c^0xffffffff)|0;}
const sig=Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=2;
fs.writeFileSync('assets/icon.png',Buffer.concat([sig,chunk('IHDR',ihdr),chunk('IDAT',idat),chunk('IEND',Buffer.alloc(0))]));
console.log('icon written');
"
```

- [ ] **Step 3: Verify icon dimensions**

Run: `file assets/icon.png`
Expected: output contains `PNG image data, 128 x 128`.

- [ ] **Step 4: Commit**

```bash
git add assets/icon.png
git commit -m "chore: add placeholder marketplace icon"
```

---

## Task 3: Audit and update .vscodeignore

**Files:**
- Modify: `.vscodeignore`

- [ ] **Step 1: Read current .vscodeignore**

Run: `cat .vscodeignore`
Expected:
```
.vscode/**
node_modules/**
src/**
webview/**
test/**
test-fixtures/**
docs/**
.superpowers/**
.claude/**
.github/**
.gitignore
tsconfig*.json
vitest*.config.ts
package-lock.json
**/*.map
out/test/**
```

- [ ] **Step 2: Replace with the audited version**

Overwrite `.vscodeignore` with:

```
.vscode/**
node_modules/**
src/**
webview/**
test/**
test-fixtures/**
docs/**
.superpowers/**
.claude/**
.github/**
.gitignore
.prettierrc
.editorconfig
tsconfig*.json
vite.config.ts
vitest*.config.ts
package-lock.json
**/*.map
**/*.vsix
out/test/**
AGENTS.md
CONTRIBUTING.md
CODE_OF_CONDUCT.md
```

Notes: `assets/` is intentionally NOT excluded (icon must ship). The CONTRIBUTING/CODE_OF_CONDUCT/AGENTS files are repo-only docs — exclude from the marketplace package to keep the .vsix lean.

- [ ] **Step 3: Commit**

```bash
git add .vscodeignore
git commit -m "chore: tighten .vscodeignore for v0.1 package"
```

---

## Task 4: Verify packaging produces the expected file list

**Files:** none modified

- [ ] **Step 1: Build the extension**

Run: `npm run build`
Expected: exits 0, produces `out/extension.js` and `out/webview/` bundle.

- [ ] **Step 2: Run vsce in list mode**

Run: `npx vsce ls --no-dependencies`
Expected: file list including `package.json`, `README.md`, `LICENSE`, `CHANGELOG.md`, `assets/icon.png`, `out/extension.js`, `out/webview/panel.js`, `out/webview/editor.js`, `out/webview/assets/*.css`. Must NOT include `src/`, `test/`, `webview/`, `node_modules/`, `docs/`, `AGENTS.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/`, `.vscode/`, `.claude/`, `*.vsix`, `out/test/`.

- [ ] **Step 3: Produce a dry-run package**

Run: `npx vsce package --no-dependencies`
Expected: exits 0, creates `merge-pro-0.1.0.vsix`. Warnings about LICENSE / repository / README are acceptable to ignore on first run but should be zero after this task.

- [ ] **Step 4: Inspect the .vsix contents**

Run: `unzip -l merge-pro-0.1.0.vsix | head -40`
Expected: shows `extension/package.json`, `extension/README.md`, `extension/assets/icon.png`, `extension/out/extension.js`. No `src/` paths.

- [ ] **Step 5: Clean up the local package**

Run: `rm merge-pro-0.1.0.vsix`
Expected: file removed (it is also gitignored, but cleaning keeps the worktree tidy).

No commit for this task — it is verification only.

---

## Task 5: Fix MergePanelProvider nonce entropy and CSP

**Files:**
- Modify: `src/providers/MergePanelProvider.ts`

**Context:** CSP audit of `MergePanelProvider.ts` found two issues:
1. The nonce generator uses `Math.random()`, which is not cryptographically secure. A predictable nonce defeats the purpose of CSP. `MergeEditorProvider.ts` already uses `randomBytes(16).toString('base64url')` from the `crypto` module — we will align on that pattern.
2. The CSP omits `style-src`. The webview React bundle injects styles, which currently work only because the default-src fallback is `'none'` and the browser permits inline UA styles — but any future styled-component or inline style attribute will be blocked silently.

- [ ] **Step 1: Add the crypto import at the top of the file**

Edit line 1 of `src/providers/MergePanelProvider.ts`. Change:

```ts
import * as vscode from 'vscode'
```

to:

```ts
import { randomBytes } from 'crypto'
import * as vscode from 'vscode'
```

- [ ] **Step 2: Replace the getNonce function**

Replace the existing block at the bottom of the file (lines 98-105):

```ts
function getNonce(): string {
    let text = ''
    const possible =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < 32; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length))
    return text
}
```

with:

```ts
function getNonce(): string {
    return randomBytes(16).toString('base64url')
}
```

- [ ] **Step 3: Update the CSP meta tag**

In the `getHtml` method (around line 83), change the CSP line from:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'strict-dynamic';">
```

to:

```html
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'strict-dynamic'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource} data:; img-src ${webview.cspSource} https: data:;">
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: exits 0 with no errors.

- [ ] **Step 5: Run unit tests**

Run: `npm test`
Expected: all tests pass. There are no tests targeting the nonce specifically; the test suite validates the surrounding behavior is unchanged.

- [ ] **Step 6: Manual smoke test**

Open VS Code in the repo, press F5 to launch the Extension Development Host. In the host window:
1. Open a workspace containing a fixture from `test-fixtures/` (or any folder with a conflict).
2. Open the Source Control sidebar — confirm the MergePro panel renders.
3. Open VS Code's Webview Developer Tools (Command Palette → `Developer: Open Webview Developer Tools`).
4. Confirm zero CSP violations in the console.
5. Click into a file to open the merge editor — confirm it renders and the editor webview also has zero CSP violations.

Expected: both webviews render without CSP violations.

- [ ] **Step 7: Commit**

```bash
git add src/providers/MergePanelProvider.ts
git commit -m "fix: use crypto-secure nonce and complete CSP in panel webview"
```

---

## Task 6: Add .vscode/extensions.json and tasks.json

**Files:**
- Create: `.vscode/extensions.json`
- Create: `.vscode/tasks.json`

- [ ] **Step 1: Create extensions.json**

Write to `.vscode/extensions.json`:

```json
{
    "recommendations": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode"
    ]
}
```

- [ ] **Step 2: Create tasks.json**

Write to `.vscode/tasks.json`:

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "type": "npm",
            "script": "build",
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "problemMatcher": ["$tsc"],
            "label": "npm: build",
            "detail": "Compile extension host and bundle webview"
        }
    ]
}
```

- [ ] **Step 3: Verify F5 still launches**

Open VS Code in the repo. Press F5. The pre-launch task `npm: build` should run, then the Extension Development Host should open.

Expected: Extension Development Host opens with no error dialog about a missing task.

- [ ] **Step 4: Commit**

```bash
git add .vscode/extensions.json .vscode/tasks.json
git commit -m "chore: add VS Code extension recommendations and build task"
```

---

## Task 7: Write the new README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Overwrite README.md**

Replace the entire contents of `README.md` with:

````markdown
# MergePro

> IntelliJ-style three-pane merge conflict resolver for VS Code, Cursor, and other VS Code forks.

[![CI](https://github.com/ismailcherri/merge-pro/actions/workflows/ci.yml/badge.svg)](https://github.com/ismailcherri/merge-pro/actions/workflows/ci.yml)
[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/ismailcherri.merge-pro?label=VS%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=ismailcherri.merge-pro)
[![Open VSX](https://img.shields.io/open-vsx/v/ismailcherri/merge-pro?label=Open%20VSX)](https://open-vsx.org/extension/ismailcherri/merge-pro)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<!-- TODO: add screenshot or GIF before publishing -->

## Features

- **SCM Panel** — grouped view of all conflicted files with per-file progress bars and conflict counts.
- **Three-Pane Editor** — Current | Result | Incoming layout with synchronized horizontal and vertical scrolling.
- **SVG Connectors** — IntelliJ-style polygon shapes connecting corresponding chunks across panes.
- **Color Language** — Green (non-conflicting), Brown (true conflict), Teal (resolved).
- **Batch Actions** — Accept All Ours, Accept All Theirs, Auto-Resolve Non-Conflicting.
- **Magic Resolve** — one-click resolution for conflicts where one side is a strict superset of the other.
- **Navigation** — `Alt+Up` and `Alt+Down` to jump between conflicts.
- **Undo/Redo** — full per-file decision history.

## Install

### VS Code Marketplace

```bash
code --install-extension ismailcherri.merge-pro
```

Or search "MergePro" in the Extensions view.

### Open VSX (Cursor, VSCodium, Windsurf, code-server)

```bash
cursor --install-extension ismailcherri.merge-pro
```

Or visit the [Open VSX listing](https://open-vsx.org/extension/ismailcherri/merge-pro).

### Sideload `.vsix`

Download the latest `.vsix` from [GitHub Releases](https://github.com/ismailcherri/merge-pro/releases) and run:

```bash
code --install-extension merge-pro-0.1.0.vsix
```

## Usage

1. Perform a `git merge` that creates conflicts.
2. Open the **Source Control** panel — MergePro lists all conflicted files with a progress indicator.
3. Click **Resolve** on a file to open the three-pane editor.
4. For each conflict, click the chunk action buttons (accept current, accept incoming, accept both) or edit the result pane directly.
5. Use **Auto-Resolve Non-Conflicting** to bulk-resolve chunks that have no true conflict.
6. Click **Save** to write the resolved file. MergePro stages the file with `git add` automatically.

## Keybindings

| Action            | Default       |
|-------------------|---------------|
| Previous conflict | `Alt+Up`      |
| Next conflict     | `Alt+Down`    |
| Open merge editor | Command Palette: `MergePro: Open Merge Editor` |

## Configuration

No user-facing settings yet. Future versions may expose color overrides and keybinding customization.

## Requirements

- VS Code 1.85+ (or a fork on the equivalent VS Code API version).
- Git (the built-in Git extension is sufficient).

## Development

```bash
git clone https://github.com/ismailcherri/merge-pro.git
cd merge-pro
npm install
```

Press `F5` in VS Code to launch the Extension Development Host.

Useful commands:

| Command                       | Purpose                              |
|-------------------------------|--------------------------------------|
| `npm run build`               | Compile host + bundle webview.       |
| `npm run watch:ext`           | Watch and rebuild the host.          |
| `npm run watch:webview`       | Watch and rebuild the webview.       |
| `npm test`                    | Run unit tests (host + webview).     |
| `npm run test:watch`          | Run tests in watch mode.             |
| `npm run test:integration`    | Run `@vscode/test-electron` suite.   |
| `npm run lint`                | ESLint over `src/` and `webview/`.   |
| `npm run format`              | Format with Prettier.                |

## Contributing

Bug reports, feature requests, and pull requests are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for details and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) for community expectations.

If you are an AI coding assistant (Claude Code, Cursor, Copilot, Codex, Aider, etc.), see [`AGENTS.md`](AGENTS.md) for project-specific guidance.

## License

[MIT](LICENSE) © Ismail Cherri
````

- [ ] **Step 2: Render check**

Run: `grep -c '^## ' README.md`
Expected: at least 9 (top-level sections present).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for v0.1 release"
```

---

## Task 8: Add CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Create CONTRIBUTING.md**

Write to `CONTRIBUTING.md`:

````markdown
# Contributing to MergePro

Thanks for your interest in MergePro. This document explains how to set up the project, run tests, and submit changes.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating you agree to uphold it.

## Development environment

- Node.js 20 or later.
- VS Code 1.85 or later (any VS Code fork on the same API works for testing).
- Git 2.30+.

```bash
git clone https://github.com/ismailcherri/merge-pro.git
cd merge-pro
npm install
```

Press `F5` in VS Code to launch the Extension Development Host with the local build attached.

## Repository layout

| Path                        | Purpose                                              |
|-----------------------------|------------------------------------------------------|
| `src/`                      | Extension host (Node, TypeScript).                   |
| `src/protocol.ts`           | Typed message contract between host and webview.    |
| `src/providers/`            | Webview hosts (`MergePanelProvider`, `MergeEditorProvider`). |
| `src/services/`             | Domain services (`GitService`, `MergeSessionManager`). |
| `src/parsers/`              | Conflict marker parsing.                             |
| `src/utils/`                | Pure helpers.                                        |
| `webview/`                  | React UIs for the panel and editor.                  |
| `webview/panel/`            | SCM sidebar React app.                               |
| `webview/editor/`           | Three-pane merge editor React app.                   |
| `test/`                     | Integration tests via `@vscode/test-electron`.       |
| `test-fixtures/`            | Fixture git repos with real merge conflicts.         |
| `docs/superpowers/specs/`   | Design documents.                                    |
| `docs/superpowers/plans/`   | Implementation plans.                                |
| `out/`                      | Build output (gitignored).                           |

## Common commands

| Command                       | Purpose                              |
|-------------------------------|--------------------------------------|
| `npm run build`               | Compile host + bundle webview.       |
| `npm run watch:ext`           | Watch and rebuild the host.          |
| `npm run watch:webview`       | Watch and rebuild the webview.       |
| `npm test`                    | Unit tests (host + webview).         |
| `npm run test:watch`          | Tests in watch mode.                 |
| `npm run test:integration`    | `@vscode/test-electron` suite.       |
| `npm run lint`                | ESLint over `src/` and `webview/`.   |
| `npm run format`              | Prettier write.                      |

## Commit conventions

We use [Conventional Commits](https://www.conventionalcommits.org/) with these prefixes:

- `feat:` — new user-facing feature.
- `fix:` — user-visible bug fix.
- `chore:` — tooling, config, deps.
- `docs:` — documentation only.
- `refactor:` — internal change with no behavior delta.
- `test:` — test-only changes.

Keep subject lines under 72 characters. Use the body to explain *why* when the diff alone is not obvious.

## Pull requests

1. Fork and create a branch from `main`.
2. Make focused changes — one logical concern per PR.
3. Add or update tests for new behavior.
4. Run `npm run lint` and `npm test` locally; CI runs both.
5. Fill out the PR template, including a test plan and screenshots for any UI change.
6. Link the issue it resolves (if any).

## Reporting bugs

Use the **Bug report** issue template. Include VS Code version, MergePro version, OS, and reproducible steps. A minimal failing fixture (similar to those under `test-fixtures/`) is the fastest path to a fix.

## Release process (maintainers)

1. Bump `version` in `package.json`.
2. Update `CHANGELOG.md` — move `## [Unreleased]` items into a new `## [X.Y.Z] - YYYY-MM-DD` section.
3. Commit and push.
4. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
5. `release.yml` packages and publishes to VS Code Marketplace, Open VSX, and GitHub Releases.

### Required GitHub secrets

| Secret      | Source                                                     |
|-------------|------------------------------------------------------------|
| `VSCE_PAT`  | Azure DevOps Personal Access Token, scope: `Marketplace > Manage`, for the `ismailcherri` publisher. |
| `OVSX_PAT`  | open-vsx.org access token for the `ismailcherri` namespace. |

Test the release pipeline before tagging by running `release.yml` via **Actions → Run workflow → dry_run: true**.
````

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING guide"
```

---

## Task 9: Add CODE_OF_CONDUCT.md

**Files:**
- Create: `CODE_OF_CONDUCT.md`

- [ ] **Step 1: Create CODE_OF_CONDUCT.md**

Write Contributor Covenant 2.1 verbatim to `CODE_OF_CONDUCT.md`. Use the official text from <https://www.contributor-covenant.org/version/2/1/code_of_conduct/>. The contact line at the bottom must read:

```
Community Impact Guidelines were inspired by [Mozilla's code of conduct enforcement ladder][Mozilla CoC].

For answers to common questions about this code of conduct, see the FAQ at
[https://www.contributor-covenant.org/faq][FAQ]. Translations are available at
[https://www.contributor-covenant.org/translations][translations].

Instances of abusive, harassing, or otherwise unacceptable behavior may be
reported to the community leaders responsible for enforcement at
ismailcherri@gmail.com.
```

The full document is too long to inline here; fetch the canonical Markdown from `https://raw.githubusercontent.com/EthicalSource/contributor_covenant/release/content/version/2/1/code_of_conduct.md` and replace the placeholder enforcement email line.

Run:
```bash
curl -fsSL https://raw.githubusercontent.com/EthicalSource/contributor_covenant/release/content/version/2/1/code_of_conduct.md -o CODE_OF_CONDUCT.md
```

Then edit `CODE_OF_CONDUCT.md` to replace any `[INSERT CONTACT METHOD]` placeholder with `ismailcherri@gmail.com`.

- [ ] **Step 2: Verify no placeholder remains**

Run: `grep -i 'insert contact' CODE_OF_CONDUCT.md`
Expected: no output (exit code 1 is fine).

- [ ] **Step 3: Commit**

```bash
git add CODE_OF_CONDUCT.md
git commit -m "docs: add Contributor Covenant 2.1"
```

---

## Task 10: Add AGENTS.md

**Files:**
- Create: `AGENTS.md`

- [ ] **Step 1: Create AGENTS.md**

Write to `AGENTS.md`:

````markdown
# AGENTS.md

Guidance for AI coding assistants (Claude Code, Cursor, GitHub Copilot, Codex, Aider, and others) contributing to MergePro.

## TL;DR

- Read the spec for any non-trivial change before editing code: `docs/superpowers/specs/`.
- Tests live next to the code they cover. Run `npm test` before claiming a task is done.
- Never commit `out/`, `*.vsix`, `node_modules/`, or anything under `test-fixtures/conflict-repo/repo/`.
- Default to no comments. Explain *why* only when the reason is non-obvious.

## Architecture map

MergePro is a VS Code extension with two runtime layers that communicate via typed messages.

```
+---------------------------+        message protocol         +-----------------------+
| Extension host (Node)     |  <-- src/protocol.ts -->         | Webview (browser)     |
|                           |                                  |                       |
|  src/extension.ts         |                                  |  webview/panel/       |
|  src/providers/*Provider  |                                  |  webview/editor/      |
|  src/services/*Service    |                                  |  (React 18 + Monaco)  |
|  src/parsers/*            |                                  |                       |
+---------------------------+                                  +-----------------------+
```

Key types and contracts live in `src/protocol.ts` and `src/types.ts`. Treat the protocol as the API boundary: host-side and webview-side changes must land together, and the discriminated unions in `protocol.ts` are the source of truth.

## Build, test, lint

| Goal              | Command                          |
|-------------------|----------------------------------|
| Type-check        | `npx tsc -p tsconfig.json --noEmit` |
| Full build        | `npm run build`                  |
| Unit tests        | `npm test`                       |
| Integration tests | `npm run test:integration`       |
| Lint              | `npm run lint`                   |
| Format            | `npm run format`                 |

CI runs lint, unit, integration, and a `vsce package --no-dependencies` dry-run on every PR. Do not push without these passing locally.

## Code conventions

- **Prettier is the source of truth** for formatting (`.prettierrc`). Run `npm run format` before committing.
- **TypeScript strict mode is on.** Do not weaken types to silence errors.
- **Default to no comments.** A well-named identifier beats a comment. Add a one-line comment only when the *why* is non-obvious (a workaround, a subtle invariant, a perf trade-off).
- **No multi-paragraph docstrings.** One line max.
- **File-size signal:** if a file grows past ~300 lines or starts mixing responsibilities, split it. Files that change together live together; split by responsibility, not by technical layer.
- **No defensive code at internal boundaries.** Trust your callers. Validate only at system boundaries (user input, git CLI output, message protocol entry).

## How to add a feature

1. Read the most recent specs in `docs/superpowers/specs/` to understand current direction.
2. If the change is non-trivial (more than a single small fix), write a spec in `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` before coding.
3. Convert the spec into a plan under `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` with bite-sized tasks.
4. Implement task by task, committing after each.

The existing files under `docs/superpowers/specs/` and `docs/superpowers/plans/` are worked examples — follow their structure.

## Do not commit

- `out/` — build output.
- `node_modules/` — dependencies.
- `*.vsix` — packaged extensions.
- `test-fixtures/conflict-repo/repo/` — generated fixture state.
- Any file containing secrets (PATs, tokens, API keys).
- `.DS_Store` and other OS metadata.

## When in doubt

Open an issue describing what you intend to do, or draft a spec first. Small focused PRs land faster than large speculative ones.
````

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add AGENTS.md for AI contributor guidance"
```

---

## Task 11: Add GitHub issue templates

**Files:**
- Create: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Create: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`

- [ ] **Step 1: Create the directory**

Run: `mkdir -p .github/ISSUE_TEMPLATE`
Expected: directory created.

- [ ] **Step 2: Create bug_report.yml**

Write to `.github/ISSUE_TEMPLATE/bug_report.yml`:

```yaml
name: Bug report
description: Report something that is not working as expected
title: 'bug: '
labels: ['bug', 'triage']
body:
  - type: textarea
    id: what-happened
    attributes:
      label: What happened?
      description: A clear and concise description of the bug.
      placeholder: When I click X, Y happens. I expected Z.
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to reproduce
      description: Minimal steps a maintainer can follow to see the bug.
      placeholder: |
        1. Clone fixture repo X.
        2. Run `git merge feature-branch`.
        3. Open the MergePro panel.
        4. ...
    validations:
      required: true
  - type: input
    id: vscode-version
    attributes:
      label: VS Code version (or fork + version)
      placeholder: '1.93.1 / Cursor 0.42.0'
    validations:
      required: true
  - type: input
    id: extension-version
    attributes:
      label: MergePro version
      placeholder: '0.1.0'
    validations:
      required: true
  - type: dropdown
    id: os
    attributes:
      label: Operating system
      options:
        - macOS
        - Linux
        - Windows
        - Other
    validations:
      required: true
  - type: textarea
    id: logs
    attributes:
      label: Logs or screenshots
      description: Output from `Developer: Open Webview Developer Tools`, or screenshots of the UI state.
      render: shell
```

- [ ] **Step 3: Create feature_request.yml**

Write to `.github/ISSUE_TEMPLATE/feature_request.yml`:

```yaml
name: Feature request
description: Suggest an enhancement or new capability
title: 'feat: '
labels: ['enhancement', 'triage']
body:
  - type: textarea
    id: problem
    attributes:
      label: Problem
      description: What user-facing problem are you trying to solve?
    validations:
      required: true
  - type: textarea
    id: proposal
    attributes:
      label: Proposed solution
      description: How would you like MergePro to behave?
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Alternatives considered
      description: Other approaches you have thought about and why they fall short.
```

- [ ] **Step 4: Create config.yml**

Write to `.github/ISSUE_TEMPLATE/config.yml`:

```yaml
blank_issues_enabled: false
contact_links:
  - name: Question or discussion
    url: https://github.com/ismailcherri/merge-pro/discussions
    about: For questions and general discussion, please use GitHub Discussions.
```

- [ ] **Step 5: Commit**

```bash
git add .github/ISSUE_TEMPLATE/
git commit -m "chore: add GitHub issue templates"
```

---

## Task 12: Add pull request template

**Files:**
- Create: `.github/PULL_REQUEST_TEMPLATE.md`

- [ ] **Step 1: Create PULL_REQUEST_TEMPLATE.md**

Write to `.github/PULL_REQUEST_TEMPLATE.md`:

```markdown
## Summary

<!-- 1-3 sentences on what changed and why. Link any related issue with `Closes #123`. -->

## Test plan

- [ ] `npm run lint` passes locally.
- [ ] `npm test` passes locally.
- [ ] `npm run test:integration` passes locally (or N/A — explain).
- [ ] Manually exercised the change in the Extension Development Host (F5).

## Screenshots

<!-- Required for any UI change. Drag images/GIFs into this section. -->

## Notes for reviewers

<!-- Anything non-obvious about the diff, trade-offs you considered, follow-ups you deferred. -->
```

- [ ] **Step 2: Commit**

```bash
git add .github/PULL_REQUEST_TEMPLATE.md
git commit -m "chore: add pull request template"
```

---

## Task 13: Reformat CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Overwrite CHANGELOG.md**

Replace contents with:

```markdown
# Changelog

All notable changes to MergePro are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-11

### Added

- Initial public release.
- SCM sidebar panel with grouped file list, progress bars, and conflict counts.
- Three-pane Monaco merge editor (Current | Result | Incoming) with synchronized scrolling.
- SVG connectors linking corresponding chunks across panes.
- Color language: green (non-conflicting), brown (true conflict), teal (resolved).
- Batch actions: Accept All Ours, Accept All Theirs, Auto-Resolve Non-Conflicting.
- Magic Resolve column for one-click superset resolutions.
- Decision buttons per chunk with line-number gutter and gutter connectors.
- Conflict navigation: `Alt+Up`, `Alt+Down`.
- Undo/redo of per-file decisions.

[Unreleased]: https://github.com/ismailcherri/merge-pro/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ismailcherri/merge-pro/releases/tag/v0.1.0
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: reformat CHANGELOG to Keep-a-Changelog"
```

---

## Task 14: Extend ci.yml with lint and integration steps

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Overwrite ci.yml**

Replace contents with:

```yaml
name: CI

on:
    push:
        branches: [main]
    pull_request:
        branches: [main]

jobs:
    test:
        runs-on: ubuntu-latest

        steps:
            - uses: actions/checkout@v4

            - name: Setup Node.js
              uses: actions/setup-node@v4
              with:
                  node-version: '20'
                  cache: 'npm'

            - name: Install dependencies
              run: npm ci

            - name: Lint
              run: npm run lint

            - name: Unit tests
              run: npm test

            - name: Build
              run: npm run build

            - name: Integration tests (xvfb)
              run: xvfb-run -a npm run test:integration

            - name: Package (dry run)
              run: npx vsce package --no-dependencies
```

- [ ] **Step 2: Lint locally first to make sure CI will not fail**

Run: `npm run lint`
Expected: exits 0. If it fails, fix the violations in a separate commit before the CI change lands.

- [ ] **Step 3: Confirm the integration target exists**

Run: `npm run | grep test:integration`
Expected: shows the `test:integration` script.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run lint and integration tests in CI"
```

---

## Task 15: Add release.yml

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create release.yml**

Write to `.github/workflows/release.yml`:

```yaml
name: Release

on:
    push:
        tags:
            - 'v*.*.*'
    workflow_dispatch:
        inputs:
            dry_run:
                description: 'Build and package without publishing'
                type: boolean
                default: true

jobs:
    release:
        runs-on: ubuntu-latest
        permissions:
            contents: write

        steps:
            - uses: actions/checkout@v4

            - name: Setup Node.js
              uses: actions/setup-node@v4
              with:
                  node-version: '20'
                  cache: 'npm'

            - name: Install dependencies
              run: npm ci

            - name: Lint
              run: npm run lint

            - name: Unit tests
              run: npm test

            - name: Build
              run: npm run build

            - name: Package
              run: npx vsce package --no-dependencies

            - name: Publish to VS Code Marketplace
              if: github.event_name == 'push' || inputs.dry_run == false
              run: npx vsce publish --packagePath *.vsix --pat ${{ secrets.VSCE_PAT }}

            - name: Publish to Open VSX
              if: github.event_name == 'push' || inputs.dry_run == false
              run: npx ovsx publish *.vsix --pat ${{ secrets.OVSX_PAT }}

            - name: Create GitHub Release
              if: github.event_name == 'push' || inputs.dry_run == false
              uses: softprops/action-gh-release@v2
              with:
                  files: '*.vsix'
                  generate_release_notes: true
```

- [ ] **Step 2: Validate YAML**

Run: `node -e "require('js-yaml')" 2>/dev/null || npm exec --yes -- js-yaml .github/workflows/release.yml > /dev/null`

If `js-yaml` is unavailable, use:
```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"
```

Expected: exits 0 with no parse error.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add tag-driven release workflow"
```

---

## Task 16: Final verification pass

**Files:** none modified

- [ ] **Step 1: Clean build**

Run: `rm -rf out && npm run build`
Expected: exits 0.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: exits 0.

- [ ] **Step 3: Unit tests**

Run: `npm test`
Expected: all green.

- [ ] **Step 4: Integration tests**

Run: `npm run test:integration`
Expected: all green. On non-Linux this runs directly; on Linux you need a display, but you are running locally on macOS so it should just work.

- [ ] **Step 5: Package dry-run**

Run: `npx vsce package --no-dependencies`
Expected: exits 0, produces `merge-pro-0.1.0.vsix` with zero warnings.

- [ ] **Step 6: Inspect the package contents one more time**

Run: `unzip -l merge-pro-0.1.0.vsix`
Expected: contains `extension/package.json`, `extension/README.md`, `extension/CHANGELOG.md`, `extension/LICENSE`, `extension/assets/icon.png`, `extension/out/extension.js`, `extension/out/webview/*`. Does NOT contain `extension/src/`, `extension/test/`, `extension/AGENTS.md`, `extension/CONTRIBUTING.md`, `extension/CODE_OF_CONDUCT.md`, `extension/.github/`, `extension/docs/`, `extension/node_modules/`.

- [ ] **Step 7: Clean local package**

Run: `rm merge-pro-0.1.0.vsix`
Expected: file removed.

No commit for this task.

---

## Task 17: Rollout checklist (manual, post-merge)

This task is not executed by the implementing agent. It is a checklist for the maintainer to run after the PR merges. Leave it in the plan as a record.

- [ ] Register publisher `ismailcherri` at <https://marketplace.visualstudio.com/manage/createpublisher>.
- [ ] Register namespace `ismailcherri` (or fall back to `merge-pro`) at <https://open-vsx.org/user-settings/namespaces>.
- [ ] Generate Azure DevOps PAT with `Marketplace > Manage` scope. Add as repo secret `VSCE_PAT`.
- [ ] Generate Open VSX access token. Add as repo secret `OVSX_PAT`.
- [ ] Run `release.yml` via **Actions → Run workflow → dry_run: true**. Confirm package step succeeds and publish steps are skipped.
- [ ] On a clean commit: `git tag v0.1.0 && git push origin v0.1.0`. Watch the workflow.
- [ ] Verify the extension appears on the VS Code Marketplace and Open VSX listings.
- [ ] Smoke test: install in clean VS Code and clean Cursor, run through the README usage section on a real merge conflict.
- [ ] Capture screenshots/GIFs and replace the `<!-- TODO -->` block in `README.md`. This can land as a follow-up PR — listings can be refreshed without re-versioning.

---

## Self-review notes

- **Spec coverage:** all four workstreams have tasks. Manifest (Task 1, 3, 4), branding/icon (Task 2), code hardening (Tasks 5, 6), docs (Tasks 7-13), CI (Task 14), release automation (Task 15), final verification (Task 16), rollout (Task 17, manual).
- **CSP audit:** the spec called for an audit with a 50-line fix budget. Audit was performed during planning. Two issues found in `MergePanelProvider`: weak nonce, missing `style-src`. Both fixed in Task 5 (~6 lines total). `MergeEditorProvider` was clean.
- **`activationEvents` removal:** handled in Task 1. No code change in `src/extension.ts` is needed; commands and the SCM view will activate on demand.
- **Open VSX fallback:** noted in Task 17. The plan does not require it but leaves the path open.
- **Placeholder icon:** generated as a solid-color PNG. Easy to swap later without a version bump.
