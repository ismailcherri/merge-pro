// CSS custom-property references for the merge-state chunk colors used by SVG
// fills (gutter connector, chunk-band overlay). Each value includes a fallback
// rgba literal that matches the default registered in `package.json`'s
// `contributes.colors`, so the UI degrades gracefully if VS Code has not
// injected the token (e.g. during the brief first paint).
//
// In-pane backgrounds live in the <style> block in ThreePaneEditor.tsx and
// reference the same tokens directly via var(...) in CSS — they do not import
// from this module.

export const CHUNK_FILL = {
    /** Unresolved conflict — uses the Ours-side conflict color. */
    conflict:
        'var(--vscode-mergePro-conflict-oursBackground, rgba(188,63,60,0.28))',
    /** Non-conflicting auto-mergeable chunk — uses the Ours-side color. */
    nonConflicting:
        'var(--vscode-mergePro-nonConflicting-oursBackground, rgba(98,178,98,0.15))',
    /** Resolved chunk — shared across all panes. */
    resolved:
        'var(--vscode-mergePro-resolved-background, rgba(78,201,176,0.12))',
    /**
     * Partial state (one side decided, the other not). Renders with the same
     * token as `conflict`; visual distinction from the full-conflict state is
     * intentionally dropped in v1 to keep token count low.
     */
    partial:
        'var(--vscode-mergePro-conflict-oursBackground, rgba(188,63,60,0.28))',
} as const

export type ChunkFillKey = keyof typeof CHUNK_FILL
