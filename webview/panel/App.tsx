import { useEffect, useState } from 'react';
import { SessionHeader } from './SessionHeader';
import { BatchActionsBar } from './BatchActionsBar';
import { FileList } from './FileList';
import type { WebviewSessionState } from '../../src/protocol';
import vscode from './vscode';

export function App() {
  const [state, setState] = useState<WebviewSessionState>({ files: [] });

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data as { type?: string; state?: WebviewSessionState };
      if (msg.type === 'stateUpdate' && msg.state != null && Array.isArray(msg.state.files)) {
        setState(msg.state);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const resolved = state.files.filter((f) => f.resolvedChunks >= f.totalChunks && f.totalChunks > 0).length;
  const total = state.files.length;

  const handleResolve = (uri: string) => vscode.postMessage({ type: 'openEditor', uri });
  const handleBatchAccept = (uri: string, side: 'ours' | 'theirs') => vscode.postMessage({ type: 'batchAccept', uri, side });
  const handleAutoResolve = (uri: string) => vscode.postMessage({ type: 'autoResolve', uri });

  return (
    <div style={{ fontFamily: 'var(--vscode-font-family)', fontSize: 'var(--vscode-font-size)', color: 'var(--vscode-foreground)' }}>
      <SessionHeader total={total} resolved={resolved} />
      <BatchActionsBar activeUri={state.activeEditorUri} onBatchAccept={handleBatchAccept} onAutoResolve={handleAutoResolve} />
      <FileList files={state.files} onResolve={handleResolve} activeUri={state.activeEditorUri} />
    </div>
  );
}
