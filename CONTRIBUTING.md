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
