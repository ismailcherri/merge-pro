interface Props {
  total: number;
  resolved: number;
}

export function SessionHeader({ total, resolved }: Props) {
  const pct = total === 0 ? 0 : Math.round((resolved / total) * 100);
  const allDone = resolved === total && total > 0;

  return (
    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--vscode-panel-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, opacity: 0.8 }}>
        <span>MERGE IN PROGRESS</span>
        <span style={{ color: allDone ? 'var(--vscode-testing-iconPassed)' : undefined }}>
          {allDone ? 'All resolved ✓' : `${resolved} / ${total} files resolved`}
        </span>
      </div>
      <div style={{ height: 3, background: 'var(--vscode-progressBar-background, rgba(255,255,255,0.1))', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--vscode-testing-iconPassed, #4ec9b0)', borderRadius: 2, transition: 'width 0.2s' }} />
      </div>
    </div>
  );
}
