# Dependency Refresh — Implementation Plan

**Date:** 2026-08-29

1. Capture the current dependency, peer, engine, and audit state.
2. Upgrade compatible direct dependencies and security overrides.
3. Regenerate the npm lockfile and verify a clean `npm ci` install.
4. Resolve any type, lint, test, build, or packaging regressions.
5. Run the full local CI-equivalent validation suite and record exclusions.
