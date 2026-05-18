# AGENTS.md

Guidance for AI coding assistants (Claude Code, Cursor, GitHub Copilot, Codex, Aider, and others) contributing to MergePro.

## TL;DR

- Read the spec for any non-trivial change before editing code: `docs/superpowers/specs/`.
- Tests live under `test/`. Run `npm test` before claiming a task is done.
- Never commit `out/`, `*.vsix`, `node_modules/`, or anything under `test-fixtures/conflict-repo/repo/`.
- Default to no comments. Explain _why_ only when the reason is non-obvious.

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

| Goal              | Command                             |
| ----------------- | ----------------------------------- |
| Type-check        | `npx tsc -p tsconfig.json --noEmit` |
| Full build        | `npm run build`                     |
| Unit tests        | `npm test`                          |
| Integration tests | `npm run test:integration`          |
| Lint              | `npm run lint`                      |
| Format            | `npm run format`                    |

CI runs lint, unit, integration, and a `vsce package --no-dependencies` dry-run on every PR. Do not push without these passing locally.

## Code conventions

- **Prettier is the source of truth** for formatting (`.prettierrc`). Run `npm run format` before committing.
- **TypeScript strict mode is on.** Do not weaken types to silence errors.
- **Default to no comments.** A well-named identifier beats a comment. Add a one-line comment only when the _why_ is non-obvious (a workaround, a subtle invariant, a perf trade-off).
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
