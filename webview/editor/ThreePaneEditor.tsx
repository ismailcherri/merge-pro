import * as monaco from 'monaco-editor'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ConflictChunk } from '../../src/protocol'
import { resolveFile } from '../../src/utils/ConflictResolver'
import { EditorPane, EditorPaneHandle } from './EditorPane'
import { GutterConnector } from './GutterConnector'
import { Toolbar } from './Toolbar'
import { buildDisplayDocuments, DisplayRange } from './buildDisplayDocuments'

interface Props {
    oursText: string
    baseText: string
    theirsText: string
    chunks: ConflictChunk[]
    fileName: string
    language: string
    onChunkResolved: (chunkIndex: number, decision: 'ours' | 'theirs') => void
    onSave: (content: string) => void
}

const GUTTER_WIDTH = 52
// 2px border per gutter side × 2 gutters = 4 extra px
const PANE_WIDTH = `calc((100% - ${GUTTER_WIDTH * 2 + 4}px) / 3)`

if (typeof document !== 'undefined') {
    const style = document.createElement('style')
    style.textContent = `
    .merge-ours-conflict         { background: rgba(188,63,60,0.28); border-left: 2px solid rgba(220,80,70,0.6); }
    .merge-ours-nonconflicting   { background: rgba(98,178,98,0.15); }
    .merge-ours-resolved         { background: rgba(78,201,176,0.12); }
    .merge-theirs-conflict       { background: rgba(60,100,188,0.28); border-right: 2px solid rgba(70,120,220,0.6); }
    .merge-theirs-nonconflicting { background: rgba(197,134,192,0.15); }
    .merge-theirs-resolved       { background: rgba(78,201,176,0.12); }
    .merge-result-unresolved     { background: rgba(160,100,40,0.18); }
    .merge-result-resolved       { background: rgba(78,201,176,0.12); }
  `
    document.head.appendChild(style)
}

function buildPaneDecorations(
    chunks: ConflictChunk[],
    displayRanges: DisplayRange[],
    pane: 'ours' | 'result' | 'theirs'
): monaco.editor.IModelDeltaDecoration[] {
    return chunks.map((chunk, i) => {
        const range = displayRanges[i]
        if (!range) return null as unknown as monaco.editor.IModelDeltaDecoration

        const isResolved = chunk.resolvedWith !== undefined

        let className: string
        if (pane === 'ours') {
            className = isResolved
                ? 'merge-ours-resolved'
                : chunk.type === 'conflict'
                  ? 'merge-ours-conflict'
                  : 'merge-ours-nonconflicting'
        } else if (pane === 'theirs') {
            className = isResolved
                ? 'merge-theirs-resolved'
                : chunk.type === 'conflict'
                  ? 'merge-theirs-conflict'
                  : 'merge-theirs-nonconflicting'
        } else {
            // result pane
            className = isResolved ? 'merge-result-resolved' : 'merge-result-unresolved'
        }

        return {
            range: new monaco.Range(range.start, 1, range.end, 1),
            options: {
                isWholeLine: true,
                className,
            },
        }
    }).filter(Boolean) as monaco.editor.IModelDeltaDecoration[]
}

export function ThreePaneEditor({
    oursText,
    baseText,
    theirsText,
    chunks,
    fileName,
    language,
    onChunkResolved,
    onSave,
}: Props) {
    const leftRef = useRef<EditorPaneHandle>(null)
    const centerRef = useRef<EditorPaneHandle>(null)
    const rightRef = useRef<EditorPaneHandle>(null)
    const [scrollTop, setScrollTop] = useState(0)
    const [currentConflictIdx, setCurrentConflictIdx] = useState(0)
    const [editorsMounted, setEditorsMounted] = useState(0)
    const scrollingRef = useRef(false)

    const conflictChunks = useMemo(
        () => chunks.filter((c) => c.type === 'conflict' && c.resolvedWith === undefined),
        [chunks]
    )
    const totalConflicts = conflictChunks.length

    const { ours, result, theirs, displayRanges } = useMemo(
        () => buildDisplayDocuments(baseText, chunks),
        [baseText, chunks]
    )

    // Force gutter recalculation after editors mount
    const editorsReady = editorsMounted >= 3 && leftRef.current?.getEditor() != null

    const leftEditor = editorsReady ? leftRef.current!.getEditor()! : null
    const centerEditor = editorsReady ? centerRef.current!.getEditor()! : null
    const rightEditor = editorsReady ? rightRef.current!.getEditor()! : null

    const oursDecorations = useMemo(
        () => buildPaneDecorations(chunks, displayRanges, 'ours'),
        [chunks, displayRanges]
    )
    const resultDecorations = useMemo(
        () => buildPaneDecorations(chunks, displayRanges, 'result'),
        [chunks, displayRanges]
    )
    const theirsDecorations = useMemo(
        () => buildPaneDecorations(chunks, displayRanges, 'theirs'),
        [chunks, displayRanges]
    )

    // Guarded scroll sync — prevents feedback loop
    const handleScroll = useCallback((e: monaco.IScrollEvent) => {
        if (scrollingRef.current) return
        scrollingRef.current = true
        const top = e.scrollTop
        setScrollTop(top)
        leftRef.current?.getEditor()?.setScrollTop(top)
        centerRef.current?.getEditor()?.setScrollTop(top)
        rightRef.current?.getEditor()?.setScrollTop(top)
        requestAnimationFrame(() => {
            scrollingRef.current = false
        })
    }, [])

    const handleEditorMounted = useCallback(() => {
        setEditorsMounted((n) => n + 1)
    }, [])

    const getTopFn = useCallback(
        (editor: monaco.editor.IStandaloneCodeEditor | null) =>
            (line: number) =>
                editor?.getTopForLineNumber(line) ?? (line - 1) * 19,
        []
    )

    const navigateConflict = (direction: 1 | -1) => {
        const next = Math.max(
            0,
            Math.min(totalConflicts - 1, currentConflictIdx + direction)
        )
        setCurrentConflictIdx(next)
        const chunk = conflictChunks[next]
        if (!chunk) return
        // Find display range for this conflict chunk in the full chunks array
        const fullIdx = chunks.indexOf(chunk)
        const displayRange = displayRanges[fullIdx]
        const line = displayRange?.start ?? chunk.baseStartLine + 1
        leftRef.current?.getEditor()?.revealLineInCenter(line)
        centerRef.current?.getEditor()?.revealLineInCenter(line)
        rightRef.current?.getEditor()?.revealLineInCenter(line)
    }

    const handleAccept = (chunkIndex: number, side: 'ours' | 'theirs') => {
        onChunkResolved(chunkIndex, side)
    }

    const autoResolve = () => {
        chunks.forEach((c, i) => {
            if (c.type === 'non-conflicting' && c.resolvedWith === undefined) {
                onChunkResolved(i, c.winner ?? 'ours')
            }
        })
    }

    const editorHeight = leftEditor?.getContainerDomNode()?.clientHeight ?? 300

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
            }}
        >
            <Toolbar
                fileName={fileName}
                currentConflict={currentConflictIdx + 1}
                totalConflicts={totalConflicts}
                onPrev={() => navigateConflict(-1)}
                onNext={() => navigateConflict(1)}
                onAutoResolve={autoResolve}
                onSave={() => {
                    const resultContent = centerRef.current?.getEditor()?.getValue()
                    onSave(resultContent ?? resolveFile(baseText, chunks))
                }}
            />

            {/* Column headers */}
            <div
                style={{
                    display: 'flex',
                    fontSize: 11,
                    fontWeight: 600,
                    borderBottom: '1px solid var(--vscode-panel-border)',
                    flexShrink: 0,
                }}
            >
                <div
                    style={{
                        width: PANE_WIDTH,
                        padding: '3px 8px',
                        color: '#e07070',
                        background: 'rgba(188,63,60,0.08)',
                    }}
                >
                    Ours
                </div>
                <div style={{ width: GUTTER_WIDTH }} />
                <div
                    style={{
                        width: PANE_WIDTH,
                        padding: '3px 8px',
                        color: '#4ec9b0',
                        background: 'rgba(78,201,176,0.04)',
                        textAlign: 'center',
                    }}
                >
                    Result
                </div>
                <div style={{ width: GUTTER_WIDTH }} />
                <div
                    style={{
                        width: PANE_WIDTH,
                        padding: '3px 8px',
                        color: '#7090e0',
                        background: 'rgba(60,100,188,0.08)',
                        textAlign: 'right',
                    }}
                >
                    Theirs
                </div>
            </div>

            {/* Three-pane editors */}
            <div
                style={{
                    display: 'flex',
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                }}
            >
                <div
                    id="merge-pane-ours"
                    style={{
                        width: PANE_WIDTH,
                        height: '100%',
                        overflow: 'hidden',
                        flexShrink: 0,
                        position: 'relative',
                    }}
                >
                    <EditorPane
                        ref={leftRef}
                        value={ours}
                        language={language}
                        readOnly
                        decorations={oursDecorations}
                        onDidScrollChange={handleScroll}
                        onMount={handleEditorMounted}
                    />
                </div>
                <div style={{ width: GUTTER_WIDTH, flexShrink: 0, flexGrow: 0, position: 'relative', overflow: 'hidden', borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                    <GutterConnector
                        chunks={chunks}
                        displayRanges={displayRanges}
                        getTop={getTopFn(leftEditor)}
                        height={editorHeight}
                        width={GUTTER_WIDTH}
                        scrollTop={scrollTop}
                        side="left"
                        onAcceptOurs={(i) => handleAccept(i, 'ours')}
                    />
                </div>
                <div
                    id="merge-pane-result"
                    style={{
                        width: PANE_WIDTH,
                        height: '100%',
                        overflow: 'hidden',
                        flexShrink: 0,
                        position: 'relative',
                    }}
                >
                    <EditorPane
                        ref={centerRef}
                        value={result}
                        language={language}
                        readOnly={false}
                        showScrollbar
                        decorations={resultDecorations}
                        onDidScrollChange={handleScroll}
                        onMount={handleEditorMounted}
                    />
                </div>
                <div style={{ width: GUTTER_WIDTH, flexShrink: 0, flexGrow: 0, position: 'relative', overflow: 'hidden', borderLeft: '1px solid rgba(255,255,255,0.06)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                    <GutterConnector
                        chunks={chunks}
                        displayRanges={displayRanges}
                        getTop={getTopFn(centerEditor)}
                        height={editorHeight}
                        width={GUTTER_WIDTH}
                        scrollTop={scrollTop}
                        side="right"
                        onAcceptTheirs={(i) => handleAccept(i, 'theirs')}
                    />
                </div>
                <div
                    id="merge-pane-theirs"
                    style={{
                        width: PANE_WIDTH,
                        height: '100%',
                        overflow: 'hidden',
                        flexShrink: 0,
                        position: 'relative',
                    }}
                >
                    <EditorPane
                        ref={rightRef}
                        value={theirs}
                        language={language}
                        readOnly
                        decorations={theirsDecorations}
                        onDidScrollChange={handleScroll}
                        onMount={handleEditorMounted}
                    />
                </div>
            </div>
        </div>
    )
}
