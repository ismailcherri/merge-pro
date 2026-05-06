// Pure TypeScript — no vscode imports. Safe to import from webview bundles.

export interface ConflictChunk {
  type: 'non-conflicting' | 'conflict';
  /** Lines from the ours version in this region */
  oursLines: string[];
  /** Lines from the theirs version in this region */
  theirsLines: string[];
  /** 0-indexed start line in base (inclusive) */
  baseStartLine: number;
  /** 0-indexed end line in base (exclusive) */
  baseEndLine: number;
  /** Set when the user has made a resolution decision. Absence means unresolved. */
  resolvedWith?: 'ours' | 'theirs' | 'manual';
  /** Only set when resolvedWith === 'manual' */
  manualLines?: string[];
  /** For non-conflicting chunks: which side's content should be used as the resolution. */
  winner?: 'ours' | 'theirs';
}

// Webview-safe state (vscode.Uri serialized as strings)
export interface WebviewFileState {
  uri: string;
  fileName: string;
  totalChunks: number;
  resolvedChunks: number;
}

export interface WebviewSessionState {
  files: WebviewFileState[];
  /** URI of the file currently open in the merge editor, if any */
  activeEditorUri?: string;
}

// ── Message protocol ─────────────────────────────────────────────────────────

export type HostToPanel =
  | { type: 'stateUpdate'; state: WebviewSessionState };

export type PanelToHost =
  | { type: 'openEditor'; uri: string }
  | { type: 'batchAccept'; uri: string; side: 'ours' | 'theirs' }
  | { type: 'autoResolve'; uri: string };

export type HostToEditor =
  | {
      type: 'init';
      oursText: string;
      baseText: string;
      theirsText: string;
      chunks: ConflictChunk[];
      fileName: string;
      uri: string;
    }
  | { type: 'chunkUpdate'; chunks: ConflictChunk[] };

export type EditorToHost =
  | { type: 'ready' }
  | { type: 'chunkResolved'; chunkIndex: number; decision: 'ours' | 'theirs' }
  | { type: 'chunkResolvedManual'; chunkIndex: number; lines: string[] }
  | { type: 'saveFile'; uri: string; content: string };
