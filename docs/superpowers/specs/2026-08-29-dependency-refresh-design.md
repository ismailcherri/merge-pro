# Dependency Refresh — Design

**Date:** 2026-08-29
**Status:** Approved for implementation

## Goal

Refresh MergePro's npm dependencies to the newest compatible releases, remove known
dependency vulnerabilities, and verify that the extension host, React webviews,
tests, and VS Code package still work.

## Approach

- Upgrade patch and minor releases within the current compatible toolchain.
- Keep ESLint 9 because `eslint-plugin-react` does not declare ESLint 10 support.
- Keep TypeScript 6 because `typescript-eslint` supports TypeScript versions below
  6.1.
- Keep `@types/vscode` at 1.125 to match the extension's declared VS Code minimum.
- Keep installed packages whose published version is newer than the registry's
  current `latest` tag rather than downgrading them.
- Refresh security overrides and transitive lockfile resolutions until `npm audit`
  reports no known vulnerabilities.

## Verification

Run a clean install followed by formatting, type-checking, linting, unit and webview
tests, integration tests, production builds, and a VSIX packaging dry run. Inspect
the resulting package contents for accidental build paths or dependency leakage.

## Non-goals

- Raising the minimum supported VS Code version.
- Adopting dependency majors whose peer ecosystem is not yet compatible.
- Refactoring application behavior unrelated to dependency compatibility.
