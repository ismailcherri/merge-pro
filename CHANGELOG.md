# Changelog

## 0.1.0 (2026-05-18)

Initial public release.

### Features

* Three-pane Monaco merge editor (Current | Result | Incoming) with synchronized scrolling.
* SVG connectors linking corresponding chunks across panes.
* Color language: green (non-conflicting), brown (true conflict), teal (resolved).
* Inline character-level diff highlighting within conflict chunks.
* Batch actions: Accept All Ours, Accept All Theirs, Auto-Resolve Non-Conflicting.
* Magic Resolve column for one-click superset resolutions.
* Decision buttons per chunk with line-number gutter and gutter connectors.
* Conflict navigation: `Alt+Up`, `Alt+Down`.
* Undo/redo of per-file decisions.
* SCM sidebar panel with grouped CONFLICTS / RESOLVED sections, progress bars, and per-file conflict counts.
* Active-editor tracking: the panel highlights the file currently being edited and disables its Resolve button while the editor is open.
* Auto-stage on save: when a file is saved with no remaining conflict markers, MergePro runs `git add` so the file leaves the Source Control panel's "Merge Changes" section.
* Modal warning when saving a file that still contains conflict markers, with a count of unresolved chunks; the file is written but **not** staged in that case.
* Reopen prompt when the merge editor is closed with unsaved decisions, so the user can return and save without losing work.
