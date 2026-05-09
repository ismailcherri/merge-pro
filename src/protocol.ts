// Pure TypeScript — no vscode imports. Safe to import from webview bundles.

export type SideDecision = 'accept' | 'discard'

export interface ConflictChunk {
    type: 'non-conflicting' | 'conflict'
    /** Lines from the ours version in this region */
    oursLines: string[]
    /** Lines from the base (common ancestor) version in this region */
    baseLines: string[]
    /** Lines from the theirs version in this region */
    theirsLines: string[]
    /** 0-indexed start line in base (inclusive) */
    baseStartLine: number
    /** 0-indexed end line in base (exclusive) */
    baseEndLine: number
    /** Per-side decisions. A chunk is "resolved" once both sides have a
     *  decision (or `manualLines` is set). */
    oursDecision?: SideDecision
    theirsDecision?: SideDecision
    /** When set, overrides per-side decisions and uses these lines verbatim. */
    manualLines?: string[]
    /** For non-conflicting chunks: which side's content should be used as the resolution. */
    winner?: 'ours' | 'theirs'
}

export function isChunkResolved(chunk: ConflictChunk): boolean {
    if (chunk.manualLines !== undefined) return true
    return chunk.oursDecision !== undefined && chunk.theirsDecision !== undefined
}

/**
 * Compute the lines that should appear in the result document for a chunk.
 * Returns base lines for fully-undecided chunks. For partial decisions, treats
 * the undecided side as if it were base (no contribution yet).
 */
export function resolvedChunkLines(chunk: ConflictChunk): string[] {
    if (chunk.manualLines !== undefined) return chunk.manualLines
    const o = chunk.oursDecision
    const t = chunk.theirsDecision
    if (o === 'accept' && t === 'accept') {
        return [...chunk.oursLines, ...chunk.theirsLines]
    }
    if (o === 'accept' && t === 'discard') return chunk.oursLines
    if (o === 'discard' && t === 'accept') return chunk.theirsLines
    if (o === 'discard' && t === 'discard') return chunk.baseLines
    return chunk.baseLines
}

// Webview-safe state (vscode.Uri serialized as strings)
export interface WebviewFileState {
    uri: string
    fileName: string
    totalChunks: number
    resolvedChunks: number
}

export interface WebviewSessionState {
    files: WebviewFileState[]
    /** URI of the file currently open in the merge editor, if any */
    activeEditorUri?: string
}

// ── Message protocol ─────────────────────────────────────────────────────────

export type HostToPanel = { type: 'stateUpdate'; state: WebviewSessionState }

export type PanelToHost =
    | { type: 'openEditor'; uri: string }
    | { type: 'batchAccept'; uri: string; side: 'ours' | 'theirs' }
    | { type: 'autoResolve'; uri: string }

export type HostToEditor =
    | {
          type: 'init'
          oursText: string
          baseText: string
          theirsText: string
          chunks: ConflictChunk[]
          fileName: string
          uri: string
      }
    | { type: 'chunkUpdate'; chunks: ConflictChunk[] }

export type EditorToHost =
    | { type: 'ready' }
    | {
          type: 'chunkDecision'
          chunkIndex: number
          side: 'ours' | 'theirs'
          decision: SideDecision
      }
    | { type: 'chunkResolvedManual'; chunkIndex: number; lines: string[] }
    | { type: 'saveFile'; uri: string; content: string }
