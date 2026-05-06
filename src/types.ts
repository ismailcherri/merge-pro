// Extension host types — imports vscode, not safe for webview bundles.
// Protocol and webview-safe types live in src/protocol.ts.
import type { Uri } from 'vscode';
import type { ConflictChunk } from './protocol';

export type { ConflictChunk } from './protocol';

export interface MergeChange {
  uri: Uri;
  fileName: string;
}

export interface FileConflictState {
  uri: Uri;
  fileName: string;
  totalChunks: number;
  resolvedChunks: number;
  chunks: ConflictChunk[];
}

export interface SessionState {
  files: FileConflictState[];
}
