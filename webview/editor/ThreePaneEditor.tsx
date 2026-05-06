import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import * as monaco from 'monaco-editor';
import { EditorPane, EditorPaneHandle } from './EditorPane';
import { GutterConnector } from './GutterConnector';
import { Toolbar } from './Toolbar';
import { buildDisplayDocuments } from './buildDisplayDocuments';
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

const GUTTER_WIDTH = 52;
const PANE_WIDTH = `calc((100% - ${GUTTER_WIDTH * 2}px) / 3)`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .merge-chunk-non-conflicting { background: rgba(98,178,98,0.12); }
    .merge-chunk-conflict        { background: rgba(160,100,40,0.18); }
    .merge-chunk-resolved        { background: rgba(78,201,176,0.12); }
  `;
  document.head.appendChild(style);
}

function decorationsForPane(chunks: ConflictChunk[]): monaco.editor.IModelDeltaDecoration[] {
  return chunks.map((chunk) => ({
    range: new monaco.Range(chunk.baseStartLine + 1, 1, chunk.baseEndLine + 1, 1),
    options: {
      isWholeLine: true,
      className: `merge-chunk-${chunk.resolvedWith !== undefined ? 'resolved' : chunk.type}`,
    },
  }));
}

export function ThreePaneEditor({ oursText, baseText, theirsText, chunks, fileName, language, onChunkResolved, onSave }: Props) {
  const leftRef = useRef<EditorPaneHandle>(null);
  const centerRef = useRef<EditorPaneHandle>(null);
  const rightRef = useRef<EditorPaneHandle>(null);
  const resultRef = useRef<EditorPaneHandle>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [topEditorHeight, setTopEditorHeight] = useState(300);
  const [currentConflictIdx, setCurrentConflictIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const conflictChunks = chunks.filter((c) => c.type === 'conflict' && c.resolvedWith === undefined);
  const totalConflicts = conflictChunks.length;

  const displayDocs = useMemo(
    () => buildDisplayDocuments(baseText, chunks),
    [baseText, chunks],
  );

  const resultText = resolveFile(baseText, chunks);

  const ourDecorations   = useMemo(() => decorationsForPane(chunks), [chunks]);
  const baseDecorations  = useMemo(() => decorationsForPane(chunks), [chunks]);
  const theirDecorations = useMemo(() => decorationsForPane(chunks), [chunks]);

  const handleScroll = useCallback((e: monaco.IScrollEvent) => {
    const top = e.scrollTop;
    setScrollTop(top);
    leftRef.current?.getEditor()?.setScrollTop(top);
    centerRef.current?.getEditor()?.setScrollTop(top);
    rightRef.current?.getEditor()?.setScrollTop(top);
    resultRef.current?.getEditor()?.setScrollTop(top);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const h = entries[0].contentRect.height;
      setTopEditorHeight(Math.floor(h * 0.6) - 36);
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const getTop = useCallback(
    (editor: monaco.editor.IStandaloneCodeEditor | null) => (line: number) =>
      editor?.getTopForLineNumber(line) ?? (line - 1) * 19,
    [],
  );

  const navigateConflict = (direction: 1 | -1) => {
    const next = Math.max(0, Math.min(totalConflicts - 1, currentConflictIdx + direction));
    setCurrentConflictIdx(next);
    const chunk = conflictChunks[next];
    if (chunk) {
      const line = chunk.baseStartLine + 1;
      leftRef.current?.getEditor()?.revealLineInCenter(line);
      resultRef.current?.getEditor()?.revealLineInCenter(line);
    }
  };

  const handleAccept = (chunkIndex: number, side: 'ours' | 'theirs') => {
    onChunkResolved(chunkIndex, side);
  };

  const autoResolve = () => {
    chunks.forEach((c, i) => {
      if (c.type === 'non-conflicting' && c.resolvedWith === undefined) {
        onChunkResolved(i, c.winner ?? 'ours');
      }
    });
  };

  const leftEditor   = leftRef.current?.getEditor() ?? null;
  const centerEditor = centerRef.current?.getEditor() ?? null;
  const rightEditor  = rightRef.current?.getEditor() ?? null;

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Toolbar
        fileName={fileName}
        currentConflict={currentConflictIdx + 1}
        totalConflicts={totalConflicts}
        onPrev={() => navigateConflict(-1)}
        onNext={() => navigateConflict(1)}
        onAutoResolve={autoResolve}
        onSave={() => onSave(resultText)}
      />

      {/* Column headers */}
      <div style={{ display: 'flex', fontSize: 11, fontWeight: 600, borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0 }}>
        <div style={{ width: PANE_WIDTH, padding: '3px 8px', color: '#9cdcfe', background: 'rgba(0,122,204,0.06)' }}>Ours</div>
        <div style={{ width: GUTTER_WIDTH }} />
        <div style={{ width: PANE_WIDTH, padding: '3px 8px', color: '#4ec9b0', background: 'rgba(78,201,176,0.04)', textAlign: 'center' }}>Base</div>
        <div style={{ width: GUTTER_WIDTH }} />
        <div style={{ width: PANE_WIDTH, padding: '3px 8px', color: '#c586c0', background: 'rgba(197,134,192,0.06)', textAlign: 'right' }}>Theirs</div>
      </div>

      {/* Three-pane editors */}
      <div style={{ display: 'flex', overflow: 'hidden', height: topEditorHeight, flexShrink: 0 }}>
        <div style={{ width: PANE_WIDTH, height: '100%', overflow: 'hidden', flexShrink: 0 }}>
          <EditorPane
            ref={leftRef}
            value={displayDocs.ours}
            language={language}
            readOnly
            decorations={ourDecorations}
            onDidScrollChange={handleScroll}
          />
        </div>
        <GutterConnector
          chunks={chunks}
          leftGetTop={getTop(leftEditor)}
          rightGetTop={getTop(centerEditor)}
          height={topEditorHeight}
          width={GUTTER_WIDTH}
          scrollTop={scrollTop}
          onAcceptOurs={(i) => handleAccept(i, 'ours')}
        />
        <div style={{ width: PANE_WIDTH, height: '100%', overflow: 'hidden', flexShrink: 0 }}>
          <EditorPane
            ref={centerRef}
            value={displayDocs.base}
            language={language}
            readOnly
            decorations={baseDecorations}
            onDidScrollChange={handleScroll}
          />
        </div>
        <GutterConnector
          chunks={chunks}
          leftGetTop={getTop(centerEditor)}
          rightGetTop={getTop(rightEditor)}
          height={topEditorHeight}
          width={GUTTER_WIDTH}
          scrollTop={scrollTop}
          onAcceptTheirs={(i) => handleAccept(i, 'theirs')}
        />
        <div style={{ width: PANE_WIDTH, height: '100%', overflow: 'hidden', flexShrink: 0 }}>
          <EditorPane
            ref={rightRef}
            value={displayDocs.theirs}
            language={language}
            readOnly
            decorations={theirDecorations}
            onDidScrollChange={handleScroll}
          />
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--vscode-panel-border)', flexShrink: 0 }} />

      {/* Result label */}
      <div style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', color: '#4ec9b0', background: 'rgba(78,201,176,0.04)', flexShrink: 0 }}>
        Result
      </div>

      {/* Result editor */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <EditorPane
          ref={resultRef}
          value={resultText}
          language={language}
          readOnly={false}
          decorations={[]}
        />
      </div>
    </div>
  );
}
