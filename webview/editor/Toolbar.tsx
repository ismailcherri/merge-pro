import type { CSSProperties } from 'react';

interface Props {
  fileName: string;
  currentConflict: number;
  totalConflicts: number;
  onPrev: () => void;
  onNext: () => void;
  onAcceptAllOurs: () => void;
  onAcceptAllTheirs: () => void;
  onAutoResolve: () => void;
  onSave: () => void;
}

const btn: CSSProperties = {
  fontSize: 11, padding: '3px 10px', cursor: 'pointer', borderRadius: 3,
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: '1px solid var(--vscode-button-border, transparent)',
};

export function Toolbar({ fileName, currentConflict, totalConflicts, onPrev, onNext, onAcceptAllOurs, onAcceptAllTheirs, onAutoResolve, onSave }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0 }}>
      <button style={btn} onClick={onAcceptAllOurs}>⟵ Accept All Ours</button>
      <button style={btn} onClick={onAcceptAllTheirs}>Accept All Theirs ⟶</button>
      <button style={btn} onClick={onAutoResolve}>✦ Auto-Resolve</button>
      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, opacity: 0.7, textAlign: 'center' }}>{fileName}</div>
      <button style={btn} onClick={onPrev}>▲ Prev</button>
      <span style={{ fontSize: 11, color: totalConflicts > 0 ? 'var(--vscode-problemsWarningIcon-foreground)' : undefined, minWidth: 70, textAlign: 'center' }}>
        {totalConflicts === 0 ? 'No conflicts' : `Conflict ${currentConflict} / ${totalConflicts}`}
      </span>
      <button style={btn} onClick={onNext}>Next ▼</button>
      <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
      <button style={{ ...btn, background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }} onClick={onSave}>✓ Save</button>
    </div>
  );
}
