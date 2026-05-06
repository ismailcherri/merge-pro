import { useRef, useState, useCallback, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { EditorPane, EditorPaneHandle } from './EditorPane';
import { GutterConnector } from './GutterConnector';
import { Toolbar } from './Toolbar';
import type { ConflictChunk } from '../../src/protocol';
import { resolveFile } from '../../src/utils/ConflictResolver';

interface Props {
  oursText: string;
  baseText: string;
  theirsText: string;
  chunks: ConflictChunk[];
  fileName: string;
  language: string;
  onChunkResolved: (chunkIndex: number, decision: 'ours' | 'theirs') => void;
  onSave: (content: string) => void;
}

const GUTTER_WIDTH = 58;
const CHUNK_COLORS = {
  'non-conflicting': { className: 'merge-chunk-non-conflicting' },
  'conflict':        { className: 'merge-chunk-conflict' },
  'resolved':        { className: 'merge-chunk-resolved' },
};

// Inject CSS for Monaco decorations once
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .merge-chunk-non-conflicting { background: rgba(98,178,98,0.18); border-left: 3px solid rgba(98,178,98,0.8); }
    .merge-chunk-conflict        { background: rgba(160,100,40,0.25); border-left: 3px solid rgba(160,100,40,0.8); }
    .merge-chunk-resolved        { background: rgba(78,201,176,0.15); border-left: 3px solid rgba(78,201,176,0.8); }
  `;
  document.head.appendChild(style);
}

export function ThreePaneEditor({ oursText, baseText, theirsText, chunks, fileName, language, onChunkResolved, onSave }: Props) {
  const leftRef   = useRef<EditorPaneHandle>(null);
  const centerRef = useRef<EditorPaneHandle>(null);
  const rightRef  = useRef<EditorPaneHandle>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [editorHeight, setEditorHeight] = useState(600);
  const [currentConflictIdx, setCurrentConflictIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const conflictChunks = chunks.filter((c) => c.type === 'conflict' && c.resolvedWith === undefined);
  const totalConflicts = conflictChunks.length;

  // Result text = applying all resolved chunks to base
  const resultText = resolveFile(baseText, chunks);

  // Compute Monaco decorations for a pane
  const toDecorations = useCallback((chunkList: ConflictChunk[]): monaco.editor.IModelDeltaDecoration[] => {
    return chunkList.map((chunk) => {
      const colorKey = chunk.resolvedWith !== undefined ? 'resolved' : chunk.type;
      const { className } = CHUNK_COLORS[colorKey as keyof typeof CHUNK_COLORS] ?? CHUNK_COLORS.conflict;
      return {
        range: new monaco.Range(chunk.baseStartLine + 1, 1, Math.max(chunk.baseStartLine + 1, chunk.baseEndLine), 1),
        options: { isWholeLine: true, className },
      };
    });
  }, []);

  // Synchronized scrolling
  const handleScroll = useCallback((e: monaco.IScrollEvent) => {
    setScrollTop(e.scrollTop);
    leftRef.current?.getEditor()?.setScrollTop(e.scrollTop);
    centerRef.current?.getEditor()?.setScrollTop(e.scrollTop);
    rightRef.current?.getEditor()?.setScrollTop(e.scrollTop);
  }, []);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      setEditorHeight(entries[0].contentRect.height - 36); // subtract toolbar
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const getTop = useCallback((editor: monaco.editor.IStandaloneCodeEditor | null) => (line: number) => {
    return editor?.getTopForLineNumber(line) ?? (line - 1) * 19;
  }, []);

  const navigateConflict = (direction: 1 | -1) => {
    const next = Math.max(0, Math.min(totalConflicts - 1, currentConflictIdx + direction));
    setCurrentConflictIdx(next);
    const chunk = conflictChunks[next];
    if (chunk) {
      leftRef.current?.getEditor()?.revealLineInCenter(chunk.baseStartLine + 1);
    }
  };

  const acceptAllOurs   = () => chunks.forEach((c, i) => { if (c.type === 'conflict' && c.resolvedWith === undefined) onChunkResolved(i, 'ours'); });
  const acceptAllTheirs = () => chunks.forEach((c, i) => { if (c.type === 'conflict' && c.resolvedWith === undefined) onChunkResolved(i, 'theirs'); });
  const autoResolve     = () => chunks.forEach((c, i) => { if (c.type === 'non-conflicting') onChunkResolved(i, 'ours'); });

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Toolbar
        fileName={fileName}
        currentConflict={currentConflictIdx + 1}
        totalConflicts={totalConflicts}
        onPrev={() => navigateConflict(-1)}
        onNext={() => navigateConflict(1)}
        onAcceptAllOurs={acceptAllOurs}
        onAcceptAllTheirs={acceptAllTheirs}
        onAutoResolve={autoResolve}
        onSave={() => onSave(resultText)}
      />

      {/* Column headers */}
      <div style={{ display: 'flex', fontSize: 11, fontWeight: 'bold', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0 }}>
        <div style={{ flex: 1, padding: '4px 8px', color: '#9cdcfe', background: 'rgba(0,122,204,0.06)' }}>← Current (ours)</div>
        <div style={{ width: GUTTER_WIDTH }} />
        <div style={{ flex: 1, padding: '4px 8px', color: '#4ec9b0', background: 'rgba(78,201,176,0.04)', textAlign: 'center' }}>Result</div>
        <div style={{ width: GUTTER_WIDTH }} />
        <div style={{ flex: 1, padding: '4px 8px', color: '#c586c0', background: 'rgba(197,134,192,0.06)', textAlign: 'right' }}>Incoming (theirs) →</div>
      </div>

      {/* Editor panes + gutters */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: editorHeight }}>
        <EditorPane
          ref={leftRef}
          value={oursText}
          language={language}
          readOnly
          decorations={toDecorations(chunks)}
          onDidScrollChange={handleScroll}
        />

        <GutterConnector
          chunks={chunks}
          leftGetTop={getTop(leftRef.current?.getEditor() ?? null)}
          rightGetTop={getTop(centerRef.current?.getEditor() ?? null)}
          height={editorHeight}
          width={GUTTER_WIDTH}
          scrollTop={scrollTop}
        />

        <EditorPane
          ref={centerRef}
          value={resultText}
          language={language}
          readOnly={false}
          decorations={toDecorations(chunks)}
          onDidScrollChange={handleScroll}
        />

        <GutterConnector
          chunks={chunks}
          leftGetTop={getTop(centerRef.current?.getEditor() ?? null)}
          rightGetTop={getTop(rightRef.current?.getEditor() ?? null)}
          height={editorHeight}
          width={GUTTER_WIDTH}
          scrollTop={scrollTop}
        />

        <EditorPane
          ref={rightRef}
          value={theirsText}
          language={language}
          readOnly
          decorations={toDecorations(chunks)}
          onDidScrollChange={handleScroll}
        />
      </div>
    </div>
  );
}
