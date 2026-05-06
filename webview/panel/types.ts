export interface WebviewFileState {
  uri: string;
  fileName: string;
  totalChunks: number;
  resolvedChunks: number;
}

export interface WebviewSessionState {
  files: WebviewFileState[];
  activeEditorUri?: string;
}
