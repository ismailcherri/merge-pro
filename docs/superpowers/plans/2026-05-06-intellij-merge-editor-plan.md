# IntelliJ-style Three-Pane Merge Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the merge editor UI to match IntelliJ's 3-way diff layout — three synchronized readonly panes (Ours|Base|Theirs) with padded alignment, clickable inline accept buttons in gutters, and a full-width editable result pane below.

**Architecture:** Build three padded "display documents" with identical line counts from base text + chunks (padding shorter sides to `max(ours, base, theirs)` per chunk). Load them into synchronized Monaco editors. SVG gutters get split clickable polygons for per-chunk accept. Result pane is a separate editable Monaco editor below.

**Tech Stack:** React, Monaco Editor, SVG, Vitest

---

### Task 1: Add baseLines to ConflictChunk protocol and parser

**Files:**
- Modify: `src/protocol.ts`
- Modify: `src/parsers/ConflictParser.ts`

- [ ] **Step 1: Add baseLines to ConflictChunk type**

In `src/protocol.ts`, add the field to the `ConflictChunk` interface:

```typescript
export interface ConflictChunk {
  type: 'non-conflicting' | 'conflict';
  oursLines: string[];
  theirsLines: string[];
  /** Lines from the base (common ancestor) version for this chunk */
  baseLines: string[];
  baseStartLine: number;
  baseEndLine: number;
  resolvedWith?: 'ours' | 'theirs' | 'manual';
  manualLines?: string[];
  winner?: 'ours' | 'theirs';
}
```

- [ ] **Step 2: Populate baseLines in the parser**

In `src/parsers/ConflictParser.ts`, after line 73 (`const baseLines = splitLines(baseText);` is already there), update each chunk construction to include `baseLines`. The `baseLines` variable is already in scope. Each chunk needs:

```typescript
baseLines: baseLines.slice(chunk.baseStartLine, chunk.baseEndLine),
```

Update all four chunk construction sites:
1. Agreed non-conflicting (line 92-99): add `baseLines: baseLines.slice(Math.min(ours.baseStart, theirs.baseStart), Math.max(ours.baseEnd, theirs.baseEnd)),`
2. Conflicting (line 101-108): add `baseLines: baseLines.slice(Math.min(ours.baseStart, theirs.baseStart), Math.max(ours.baseEnd, theirs.baseEnd)),`
3. Ours-only non-conflicting (line 110-118): add `baseLines: baseLines.slice(ours.baseStart, ours.baseEnd),`
4. Theirs-only non-conflicting (line 123-131): add `baseLines: baseLines.slice(theirs.baseStart, theirs.baseEnd),`

- [ ] **Step 3: Run tests and commit**

```bash
npm test
```

Expected: All 37 tests pass, including parser tests that verify chunk structure.

```bash
git add src/protocol.ts src/parsers/ConflictParser.ts
git commit -m "feat: add baseLines to ConflictChunk for three-pane display"
```

---

### Task 2: Create display document builder utility

**Files:**
- Create: `webview/editor/buildDisplayDocuments.ts`

- [ ] **Step 1: Create the padding utility**

Create `webview/editor/buildDisplayDocuments.ts`:

```typescript
import type { ConflictChunk } from '../../src/protocol';

function splitLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

function pad(lines: string[], length: number): string[] {
  const padded = [...lines];
  while (padded.length < length) padded.push('');
  return padded;
}

interface DisplayDocuments {
  ours: string;
  base: string;
  theirs: string;
}

/**
 * Build three display documents with identical line counts by padding
 * each conflict chunk to max(ours, base, theirs) height. Unchanged base
 * regions are copied identically to all three documents.
 */
export function buildDisplayDocuments(
  fullBaseText: string,
  chunks: ConflictChunk[],
): DisplayDocuments {
  const baseLines = splitLines(fullBaseText);
  const sorted = [...chunks].sort((a, b) => a.baseStartLine - b.baseStartLine);

  const oursParts: string[] = [];
  const baseParts: string[] = [];
  const theirsParts: string[] = [];
  let cursor = 0;

  for (const chunk of sorted) {
    // Copy unmodified base lines before this chunk (identical in all three)
    const unchanged = baseLines.slice(cursor, chunk.baseStartLine);
    oursParts.push(...unchanged);
    baseParts.push(...unchanged);
    theirsParts.push(...unchanged);
    cursor = chunk.baseEndLine;

    // Pad this chunk to equal height
    const maxLines = Math.max(
      chunk.oursLines.length,
      chunk.baseLines.length,
      chunk.theirsLines.length,
    );
    oursParts.push(...pad(chunk.oursLines, maxLines));
    baseParts.push(...pad(chunk.baseLines, maxLines));
    theirsParts.push(...pad(chunk.theirsLines, maxLines));
  }

  // Copy remaining base lines after last chunk
  const tail = baseLines.slice(cursor);
  oursParts.push(...tail);
  baseParts.push(...tail);
  theirsParts.push(...tail);

  return {
    ours: oursParts.join('\n'),
    base: baseParts.join('\n'),
    theirs: theirsParts.join('\n'),
  };
}
```

- [ ] **Step 2: Run tests and commit**

```bash
npm test
```

Expected: All 37 tests pass.

```bash
git add webview/editor/buildDisplayDocuments.ts
git commit -m "feat: add display document builder with chunk padding"
```

---

### Task 3: Rewrite GutterConnector with clickable accept zones

**Files:**
- Modify: `webview/editor/GutterConnector.tsx`

- [ ] **Step 1: Rewrite GutterConnector**

Replace the entire file. Each conflict polygon becomes two clickable triangles with hover effects:

```typescript
import { useMemo } from 'react';
import type { ConflictChunk } from '../../src/protocol';

interface Props {
  chunks: ConflictChunk[];
  leftGetTop: (line: number) => number;
  rightGetTop: (line: number) => number;
  height: number;
  width: number;
  scrollTop: number;
  onAcceptOurs?: (chunkIndex: number) => void;
  onAcceptTheirs?: (chunkIndex: number) => void;
}

const COLORS = {
  'non-conflicting': { fill: 'rgba(98,178,98,0.12)', stroke: 'rgba(98,178,98,0.3)' },
  'conflict':        { fill: 'rgba(160,100,40,0.18)', stroke: 'rgba(160,100,40,0.5)' },
  'resolved':        { fill: 'rgba(78,201,176,0.15)', stroke: 'rgba(78,201,176,0.5)' },
};

const HOVER_OURS = { fill: 'rgba(86,156,214,0.35)', stroke: 'rgba(86,156,214,0.8)' };
const HOVER_THEIRS = { fill: 'rgba(197,134,192,0.35)', stroke: 'rgba(197,134,192,0.8)' };

export function GutterConnector({ chunks, leftGetTop, rightGetTop, height, width, scrollTop, onAcceptOurs, onAcceptTheirs }: Props) {
  const halfW = width / 2;

  const elements = useMemo(() => {
    return chunks.map((chunk, i) => {
      const top = leftGetTop(chunk.baseStartLine + 1) - scrollTop;
      const bottom = leftGetTop(chunk.baseEndLine + 1) - scrollTop;

      const isResolved = chunk.resolvedWith !== undefined;
      const isConflict = chunk.type === 'conflict' && !isResolved;
      const colorKey = isResolved ? 'resolved' : chunk.type;
      const baseColor = COLORS[colorKey as keyof typeof COLORS] ?? COLORS.conflict;

      // Full polygon for non-conflicting or resolved chunks
      if (!isConflict) {
        return (
          <polygon
            key={`${chunk.baseStartLine}-${chunk.baseEndLine}`}
            points={`0,${top} 0,${bottom} ${width},${bottom} ${width},${top}`}
            fill={baseColor.fill}
            stroke={baseColor.stroke}
            strokeWidth={1}
          />
        );
      }

      // Split polygon: left half = Accept Ours, right half = Accept Theirs
      const midY = (top + bottom) / 2;
      return (
        <g key={`${chunk.baseStartLine}-${chunk.baseEndLine}`}>
          {/* Left triangle: Accept Ours */}
          <polygon
            points={`0,${top} 0,${bottom} ${halfW},${midY}`}
            fill={baseColor.fill}
            stroke={baseColor.stroke}
            strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onClick={() => onAcceptOurs?.(i)}
            onMouseEnter={(e) => {
              e.currentTarget.setAttribute('fill', HOVER_OURS.fill);
              e.currentTarget.setAttribute('stroke', HOVER_OURS.stroke);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.setAttribute('fill', baseColor.fill);
              e.currentTarget.setAttribute('stroke', baseColor.stroke);
            }}
          />
          <text
            x={halfW / 2 - 4}
            y={midY + 4}
            fontSize={10}
            fill="rgba(255,255,255,0.4)"
            style={{ pointerEvents: 'none' }}
          >
            ◀
          </text>
          {/* Right triangle: Accept Theirs */}
          <polygon
            points={`${halfW},${midY} ${width},${top} ${width},${bottom}`}
            fill={baseColor.fill}
            stroke={baseColor.stroke}
            strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onClick={() => onAcceptTheirs?.(i)}
            onMouseEnter={(e) => {
              e.currentTarget.setAttribute('fill', HOVER_THEIRS.fill);
              e.currentTarget.setAttribute('stroke', HOVER_THEIRS.stroke);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.setAttribute('fill', baseColor.fill);
              e.currentTarget.setAttribute('stroke', baseColor.stroke);
            }}
          />
          <text
            x={halfW + halfW / 2 - 4}
            y={midY + 4}
            fontSize={10}
            fill="rgba(255,255,255,0.4)"
            style={{ pointerEvents: 'none' }}
          >
            ▶
          </text>
        </g>
      );
    });
  }, [chunks, leftGetTop, rightGetTop, width, scrollTop, onAcceptOurs, onAcceptTheirs]);

  return (
    <svg width={width} height={height} style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      {elements}
    </svg>
  );
}
```

- [ ] **Step 2: Run tests and commit**

```bash
npm test
```

Expected: GutterConnector test may fail due to API change. That's OK — we'll update the test in Task 7.

```bash
git add webview/editor/GutterConnector.tsx
git commit -m "feat: add clickable accept zones to gutter connector"
```

---

### Task 4: Simplify Toolbar

**Files:**
- Modify: `webview/editor/Toolbar.tsx`

- [ ] **Step 1: Remove bulk accept buttons**

Replace the file with a simplified version — remove `onAcceptAllOurs`, `onAcceptAllTheirs` props and their buttons:

```typescript
import type { CSSProperties } from 'react';

interface Props {
  fileName: string;
  currentConflict: number;
  totalConflicts: number;
  onPrev: () => void;
  onNext: () => void;
  onAutoResolve: () => void;
  onSave: () => void;
}

const btn: CSSProperties = {
  fontSize: 11, padding: '3px 10px', cursor: 'pointer', borderRadius: 3,
  background: 'var(--vscode-button-secondaryBackground)',
  color: 'var(--vscode-button-secondaryForeground)',
  border: '1px solid var(--vscode-button-border, transparent)',
};

export function Toolbar({ fileName, currentConflict, totalConflicts, onPrev, onNext, onAutoResolve, onSave }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid var(--vscode-panel-border)', flexShrink: 0 }}>
      <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, opacity: 0.7 }}>{fileName}</div>
      <button style={btn} onClick={onPrev}>▲ Prev</button>
      <span style={{ fontSize: 11, color: totalConflicts > 0 ? 'var(--vscode-problemsWarningIcon-foreground)' : undefined, minWidth: 70, textAlign: 'center' }}>
        {totalConflicts === 0 ? 'No conflicts' : `Conflict ${currentConflict} / ${totalConflicts}`}
      </span>
      <button style={btn} onClick={onNext}>Next ▼</button>
      <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.15)' }} />
      <button style={btn} onClick={onAutoResolve}>✦ Auto-Resolve</button>
      <button style={{ ...btn, background: 'var(--vscode-button-background)', color: 'var(--vscode-button-foreground)' }} onClick={onSave}>✓ Save</button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add webview/editor/Toolbar.tsx
git commit -m "refactor: simplify toolbar, remove bulk accept buttons"
```

---

### Task 5: Rewrite ThreePaneEditor with padded three-pane + result

**Files:**
- Modify: `webview/editor/ThreePaneEditor.tsx`
- Modify: `webview/editor/EditorPane.tsx` (minor: remove padding lines styling)

- [ ] **Step 1: Rewrite ThreePaneEditor**

Replace the entire file. Core changes:
- Use `buildDisplayDocuments` to create padded documents
- Three readonly editors (Ours | Base | Theirs) on top
- Result editor (editable) below with auto-scroll to current conflict
- Gutter connectors get `onAcceptOurs`/`onAcceptTheirs` callbacks
- Inject CSS for padded lines (dimmed appearance)

```typescript
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

// Inject CSS once
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .merge-chunk-non-conflicting { background: rgba(98,178,98,0.12); }
    .merge-chunk-conflict        { background: rgba(160,100,40,0.18); }
    .merge-chunk-resolved        { background: rgba(78,201,176,0.12); }
    .merge-padded-line           { opacity: 0.15; }
  `;
  document.head.appendChild(style);
}

function decorationsForPane(chunks: ConflictChunk[]): monaco.editor.IModelDeltaDecoration[] {
  return chunks.map((chunk) => {
    const colorKey = chunk.resolvedWith !== undefined ? 'resolved' : chunk.type;
    const className = `merge-chunk-${colorKey}`;
    return {
      range: new monaco.Range(chunk.baseStartLine + 1, 1, chunk.baseEndLine + 1, 1),
      options: { isWholeLine: true, className },
    };
  });
}

export function ThreePaneEditor({ oursText, baseText, theirsText, chunks, fileName, language, onChunkResolved, onSave }: Props) {
  const leftRef = useRef<EditorPaneHandle>(null);
  const centerRef = useRef<EditorPaneHandle>(null);
  const rightRef = useRef<EditorPaneHandle>(null);
  const resultRef = useRef<EditorPaneHandle>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [editorHeight, setEditorHeight] = useState(600);
  const [currentConflictIdx, setCurrentConflictIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const conflictChunks = chunks.filter((c) => c.type === 'conflict' && c.resolvedWith === undefined);
  const totalConflicts = conflictChunks.length;

  // Build padded display documents
  const displayDocs = useMemo(
    () => buildDisplayDocuments(baseText, chunks),
    [baseText, chunks],
  );

  // Result text
  const resultText = resolveFile(baseText, chunks);

  // Decorations for each pane
  const ourDecorations   = useMemo(() => decorationsForPane(chunks), [chunks]);
  const baseDecorations  = useMemo(() => decorationsForPane(chunks), [chunks]);
  const theirDecorations = useMemo(() => decorationsForPane(chunks), [chunks]);

  // Synchronized scrolling
  const handleScroll = useCallback((e: monaco.IScrollEvent) => {
    const top = e.scrollTop;
    setScrollTop(top);
    leftRef.current?.getEditor()?.setScrollTop(top);
    centerRef.current?.getEditor()?.setScrollTop(top);
    rightRef.current?.getEditor()?.setScrollTop(top);
    resultRef.current?.getEditor()?.setScrollTop(top);
  }, []);

  // Resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const h = entries[0].contentRect.height;
      // Top section = 60% of height, result = 40%
      setEditorHeight(Math.floor(h * 0.6) - 36);
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
        <div style={{ flex: 1, padding: '3px 8px', color: '#9cdcfe', background: 'rgba(0,122,204,0.06)' }}>Ours</div>
        <div style={{ width: GUTTER_WIDTH, textAlign: 'center', padding: '3px 0', opacity: 0.5 }} />
        <div style={{ flex: 1, padding: '3px 8px', color: '#4ec9b0', background: 'rgba(78,201,176,0.04)', textAlign: 'center' }}>Base</div>
        <div style={{ width: GUTTER_WIDTH, textAlign: 'center', padding: '3px 0', opacity: 0.5 }} />
        <div style={{ flex: 1, padding: '3px 8px', color: '#c586c0', background: 'rgba(197,134,192,0.06)', textAlign: 'right' }}>Theirs</div>
      </div>

      {/* Three-pane editors */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: editorHeight }}>
        <EditorPane
          ref={leftRef}
          value={displayDocs.ours}
          language={language}
          readOnly
          decorations={ourDecorations}
          onDidScrollChange={handleScroll}
        />
        <GutterConnector
          chunks={chunks}
          leftGetTop={getTop(leftEditor)}
          rightGetTop={getTop(centerEditor)}
          height={editorHeight}
          width={GUTTER_WIDTH}
          scrollTop={scrollTop}
          onAcceptOurs={(i) => handleAccept(i, 'ours')}
        />
        <EditorPane
          ref={centerRef}
          value={displayDocs.base}
          language={language}
          readOnly
          decorations={baseDecorations}
          onDidScrollChange={handleScroll}
        />
        <GutterConnector
          chunks={chunks}
          leftGetTop={getTop(centerEditor)}
          rightGetTop={getTop(rightEditor)}
          height={editorHeight}
          width={GUTTER_WIDTH}
          scrollTop={scrollTop}
          onAcceptTheirs={(i) => handleAccept(i, 'theirs')}
        />
        <EditorPane
          ref={rightRef}
          value={displayDocs.theirs}
          language={language}
          readOnly
          decorations={theirDecorations}
          onDidScrollChange={handleScroll}
        />
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
```

- [ ] **Step 2: Run tests and commit**

```bash
npm test
```

Some tests may fail due to the Toolbar prop changes and GutterConnector API change. We fix tests in Task 7.

```bash
git add webview/editor/ThreePaneEditor.tsx
git commit -m "feat: rewrite ThreePaneEditor with padded three-pane layout and result panel"
```

---

### Task 6: Update App.tsx to wire new layout

**Files:**
- Modify: `webview/editor/App.tsx`

- [ ] **Step 1: Pass baseText to ThreePaneEditor**

The `init` message already provides `baseText`. Update the `EditorState` interface and `ThreePaneEditor` call to pass it through:

In `webview/editor/App.tsx`, the `EditorState` interface (line 10-17) already has `baseText` — no change needed. The `ThreePaneEditor` call already receives `baseText={editorState.baseText}` — needs to be added if missing. Verify the JSX at line 74-84 passes `baseText`:

```typescript
<ThreePaneEditor
  oursText={editorState.oursText}
  baseText={editorState.baseText}
  theirsText={editorState.theirsText}
  chunks={editorState.chunks}
  fileName={editorState.fileName}
  language={detectLanguage(editorState.fileName)}
  onChunkResolved={handleChunkResolved}
  onSave={handleSave}
/>
```

If `baseText` is already being passed, no change needed. If not, add it.

- [ ] **Step 2: Commit**

```bash
git add webview/editor/App.tsx
git commit -m "fix: ensure baseText is passed to ThreePaneEditor"
```

---

### Task 7: Update tests

**Files:**
- Modify: `test/unit/webview/GutterConnector.test.tsx`
- Modify: `test/unit/ConflictParser.test.ts`

- [ ] **Step 1: Update GutterConnector tests for new API**

The makeChunk helper needs `baseLines`, and the new props `onAcceptOurs`/`onAcceptTheirs` need passing. Conflict chunks now render split triangles inside a `<g>` group. Update the test file:

```typescript
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GutterConnector } from '../../../webview/editor/GutterConnector';
import type { ConflictChunk } from '../../../src/protocol';

function makeChunk(baseStartLine: number, baseEndLine: number, type: 'conflict' | 'non-conflicting' = 'conflict'): ConflictChunk {
  return { type, oursLines: [], theirsLines: [], baseLines: [], baseStartLine, baseEndLine };
}

const mockGetTop = (line: number) => (line - 1) * 26;

describe('GutterConnector', () => {
  it('renders split triangles for conflict chunks', () => {
    const chunks = [makeChunk(0, 2, 'conflict')];
    const { container } = render(
      <GutterConnector
        chunks={chunks}
        leftGetTop={mockGetTop} rightGetTop={mockGetTop}
        height={300} width={52} scrollTop={0}
      />,
    );
    // Conflict chunks render two polygons inside a <g>
    const group = container.querySelector('g');
    expect(group).not.toBeNull();
    expect(group!.querySelectorAll('polygon').length).toBe(2);
  });

  it('renders single polygon for non-conflicting chunks', () => {
    const chunks = [makeChunk(0, 1, 'non-conflicting')];
    const { container } = render(
      <GutterConnector
        chunks={chunks}
        leftGetTop={mockGetTop} rightGetTop={mockGetTop}
        height={300} width={52} scrollTop={0}
      />,
    );
    const polygons = container.querySelectorAll('polygon');
    expect(polygons.length).toBe(1);
  });

  it('fires onAcceptOurs when left triangle clicked', () => {
    const onAcceptOurs = vi.fn();
    const chunks = [makeChunk(0, 2, 'conflict')];
    const { container } = render(
      <GutterConnector
        chunks={chunks}
        leftGetTop={mockGetTop} rightGetTop={mockGetTop}
        height={300} width={52} scrollTop={0}
        onAcceptOurs={onAcceptOurs}
      />,
    );
    const group = container.querySelector('g')!;
    const leftTriangle = group.querySelectorAll('polygon')[0];
    fireEvent.click(leftTriangle);
    expect(onAcceptOurs).toHaveBeenCalledWith(0);
  });

  it('fires onAcceptTheirs when right triangle clicked', () => {
    const onAcceptTheirs = vi.fn();
    const chunks = [makeChunk(0, 2, 'conflict')];
    const { container } = render(
      <GutterConnector
        chunks={chunks}
        leftGetTop={mockGetTop} rightGetTop={mockGetTop}
        height={300} width={52} scrollTop={0}
        onAcceptTheirs={onAcceptTheirs}
      />,
    );
    const group = container.querySelector('g')!;
    const rightTriangle = group.querySelectorAll('polygon')[1];
    fireEvent.click(rightTriangle);
    expect(onAcceptTheirs).toHaveBeenCalledWith(0);
  });
});
```

Run: `npx vitest run --config vitest.webview.config.ts`
Expected: 4 tests pass.

- [ ] **Step 2: Update parser tests for baseLines**

In `test/unit/ConflictParser.test.ts`, add `baseLines` to existing assertions. After each `oursLines`/`theirsLines` check, add:

```typescript
expect(chunk.baseLines).toBeDefined();
```

In the existing tests, add this assertion wherever `oursLines` and `theirsLines` are checked (lines 20-21, 35-36, 47-48, 64-65, 77-78, 103-104, 112-113):

```typescript
expect(chunks[0].baseLines.length).toBeGreaterThanOrEqual(0);
```

- [ ] **Step 3: Verify all tests pass**

```bash
npm test
```

Expected: All tests pass — parser tests (23), merge session tests (4), panel tests (11), gutter tests (4) = 42 tests total.

- [ ] **Step 4: Commit**

```bash
git add test/
git commit -m "test: update tests for IntelliJ-style editor changes"
```

---

### Task 8: Build and verification

- [ ] **Step 1: Full build**

```bash
npm run build
```

Expected: TypeScript compilation + Vite webview build succeed with no errors.

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 3: Manual verification checklist**

1. Launch extension with F5
2. Open a repo with merge conflicts
3. Verify: three panes show Ours | Base | Theirs
4. Verify: result pane is visible below with full width
5. Verify: scrolling one pane syncs all three
6. Verify: gutter shows clickable accept triangles on conflict chunks
7. Verify: clicking Accept Ours accepts the left version
8. Verify: clicking Accept Theirs accepts the right version
9. Verify: non-conflicting chunks show dimmed polygons
10. Verify: Save button writes the result

- [ ] **Step 4: Commit any fixes**

Only if adjustments were needed during verification.
