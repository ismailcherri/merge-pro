import type { WebviewFileState } from './types';

interface Props {
  file: WebviewFileState;
  onResolve: (uri: string) => void;
  isActive: boolean;
}

export function FileItem({ file, onResolve, isActive }: Props) {
  const isResolved = file.resolvedChunks >= file.totalChunks && file.totalChunks > 0;
  const pct = file.totalChunks === 0 ? 0 : (file.resolvedChunks / file.totalChunks) * 100;

  return (
    <div style={{
      padding: '6px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      borderLeft: isActive ? '2px solid var(--vscode-focusBorder)' : '2px solid transparent',
      background: isActive ? 'var(--vscode-list-activeSelectionBackground, rgba(0,122,204,0.1))' : undefined,
      opacity: isResolved ? 0.5 : 1,
    }}>
      <span style={{ fontSize: 13, color: isResolved ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-problemsWarningIcon-foreground)' }}>
        {isResolved ? '✓' : '●'}
      </span>
      <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.fileName}
      </span>
      {!isResolved && (
        <>
          <span style={{ fontSize: 10, background: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)', borderRadius: 10, padding: '1px 6px' }}>
            {file.totalChunks}
          </span>
          <button
            onClick={() => onResolve(file.uri)}
            style={{ fontSize: 10, padding: '2px 8px', cursor: 'pointer', background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: 'none', borderRadius: 3 }}>
            {isActive ? 'Editing' : 'Resolve'}
          </button>
        </>
      )}
      {isResolved && <span style={{ fontSize: 10, opacity: 0.6 }}>resolved</span>}
      {!isResolved && (
        <div style={{ position: 'absolute', bottom: 0, left: 12, right: 12, height: 2, background: 'rgba(255,255,255,0.08)' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--vscode-problemsWarningIcon-foreground)' }} />
        </div>
      )}
    </div>
  );
}
