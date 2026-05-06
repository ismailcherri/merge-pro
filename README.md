# MergePro

IntelliJ-style three-pane merge conflict resolver for VS Code.

## Features

- **SCM Panel** — grouped view of all conflicted files with per-file progress bars and conflict counts
- **Three-Pane Editor** — Current | Result | Incoming layout with synchronized scrolling
- **SVG Connectors** — IntelliJ-style polygon shapes connecting corresponding chunks across panes
- **Color Language** — Green (non-conflicting), Brown (true conflict), Teal (resolved)
- **Batch Actions** — Accept All Ours / Accept All Theirs / Auto-Resolve Non-Conflicting
- **Navigation** — `Alt+↑` / `Alt+↓` to jump between conflicts

## Usage

1. Perform a `git merge` that creates conflicts.
2. Open the **Source Control** panel — MergePro lists all conflicted files.
3. Click **Resolve** on a file to open the three-pane editor.
4. Use the chunk action buttons or batch actions to resolve conflicts.
5. Click **Save** to write the resolved file.

## Requirements

- VS Code 1.85+
- Git extension (built-in)
