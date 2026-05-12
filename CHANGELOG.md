# Changelog

All notable changes to MergePro are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-05-12

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
