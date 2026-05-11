import * as monaco from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    isChunkResolved,
    type ConflictChunk,
    type SideDecision,
} from '../../src/protocol'
import { resolveFile } from '../../src/utils/ConflictResolver'
import { buildDisplayDocuments, ChunkLineMap, LineRange } from './buildDisplayDocuments'
import { EditorPane, EditorPaneHandle } from './EditorPane'
import { GutterConnector } from './GutterConnector'
import { mapLine, Pane } from './lineMapping'
import { Toolbar } from './Toolbar'

interface Props {
    oursText: string
    baseText: string
    theirsText: string
    chunks: ConflictChunk[]
    fileName: string
    language: string
    onChunkDecision: (
        chunkIndex: number,
        side: 'ours' | 'theirs',
        decision: SideDecision
    ) => void
    onSave: (content: string) => void
}

const GUTTER_WIDTH = 48
const PANE_WIDTH = `calc((100% - ${GUTTER_WIDTH * 2 + 4}px) / 3)`

if (typeof document !== 'undefined') {
    const styleId = 'mergepro-decoration-styles'
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent = `
    .merge-ours-conflict         { background: rgba(188,63,60,0.28); border-left: 2px solid rgba(220,80,70,0.6); }
    .merge-ours-nonconflicting   { background: rgba(98,178,98,0.15); }
    .merge-ours-resolved         { background: rgba(78,201,176,0.12); }
    .merge-theirs-conflict       { background: rgba(60,100,188,0.28); border-right: 2px solid rgba(70,120,220,0.6); }
    .merge-theirs-nonconflicting { background: rgba(197,134,192,0.15); }
    .merge-theirs-resolved       { background: rgba(78,201,176,0.12); }
    .merge-result-unresolved     { background: rgba(160,100,40,0.18); }
    .merge-result-resolved       { background: rgba(78,201,176,0.12); }
    /* Thin marker showing where the *other* side inserted lines that don't
       exist here. Color matches the gutter connector for that chunk type. */
    .merge-empty-conflict-top    { border-top: 2px solid rgba(220,80,70,0.7); }
    .merge-empty-conflict-bottom { border-bottom: 2px solid rgba(220,80,70,0.7); }
    .merge-empty-nonconflict-top    { border-top: 2px solid rgba(98,178,98,0.65); }
    .merge-empty-nonconflict-bottom { border-bottom: 2px solid rgba(98,178,98,0.65); }
    .merge-empty-partial-top     { border-top: 2px solid rgba(220,80,70,0.45); }
    .merge-empty-partial-bottom  { border-bottom: 2px solid rgba(220,80,70,0.45); }
        `
        document.head.appendChild(style)
    }
}

function buildPaneDecorations(
    chunks: ConflictChunk[],
    chunkMaps: ChunkLineMap[],
    pane: Pane
): monaco.editor.IModelDeltaDecoration[] {
    const out: monaco.editor.IModelDeltaDecoration[] = []
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        const map = chunkMaps[i]
        if (!map) continue
        const range: LineRange = map[pane]
        const isResolved = isChunkResolved(chunk)

        if (range.end < range.start) {
            // Empty range in this pane: the other side has lines inserted
            // that don't exist here. Draw a thin horizontal marker between
            // the two surrounding lines, colored to match the gutter
            // connector for this chunk type.
            if (isResolved) continue
            const anyDecision =
                chunk.oursDecision !== undefined ||
                chunk.theirsDecision !== undefined
            const variant =
                chunk.type === 'conflict'
                    ? anyDecision
                        ? 'partial'
                        : 'conflict'
                    : 'nonconflict'
            if (range.start > 1) {
                out.push({
                    range: new monaco.Range(range.start - 1, 1, range.start - 1, 1),
                    options: {
                        isWholeLine: true,
                        className: `merge-empty-${variant}-bottom`,
                    },
                })
            } else {
                out.push({
                    range: new monaco.Range(1, 1, 1, 1),
                    options: {
                        isWholeLine: true,
                        className: `merge-empty-${variant}-top`,
                    },
                })
            }
            continue
        }

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
            className = isResolved ? 'merge-result-resolved' : 'merge-result-unresolved'
        }

        out.push({
            range: new monaco.Range(range.start, 1, range.end, 1),
            options: { isWholeLine: true, className },
        })
    }
    return out
}

export function ThreePaneEditor({
    oursText,
    baseText,
    theirsText,
    chunks,
    fileName,
    language,
    onChunkDecision,
    onSave,
}: Props) {
    const leftRef = useRef<EditorPaneHandle>(null)
    const centerRef = useRef<EditorPaneHandle>(null)
    const rightRef = useRef<EditorPaneHandle>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const [currentConflictIdx, setCurrentConflictIdx] = useState(0)
    const [editorsMounted, setEditorsMounted] = useState(0)
    const [paneHeight, setPaneHeight] = useState(300)
    const syncingRef = useRef(false)

    const conflictChunks = useMemo(
        () => chunks.filter((c) => c.type === 'conflict' && !isChunkResolved(c)),
        [chunks]
    )
    const totalConflicts = conflictChunks.length

    const { ours, result, theirs, chunkMaps } = useMemo(
        () => buildDisplayDocuments(oursText, baseText, theirsText, chunks),
        [oursText, baseText, theirsText, chunks]
    )

    const editorsReady =
        editorsMounted >= 3 &&
        leftRef.current?.getEditor() != null &&
        centerRef.current?.getEditor() != null &&
        rightRef.current?.getEditor() != null

    const leftEditor = editorsReady ? leftRef.current!.getEditor()! : null
    const centerEditor = editorsReady ? centerRef.current!.getEditor()! : null
    const rightEditor = editorsReady ? rightRef.current!.getEditor()! : null

    const oursDecorations = useMemo(
        () => buildPaneDecorations(chunks, chunkMaps, 'ours'),
        [chunks, chunkMaps]
    )
    const resultDecorations = useMemo(
        () => buildPaneDecorations(chunks, chunkMaps, 'result'),
        [chunks, chunkMaps]
    )
    const theirsDecorations = useMemo(
        () => buildPaneDecorations(chunks, chunkMaps, 'theirs'),
        [chunks, chunkMaps]
    )

    // Imperative line-anchored scroll sync. The source pane's scroll
    // position is converted to a (line, fractional offset) anchor; that
    // anchor is mapped to each other pane's line space via `chunkMaps` and
    // the target pane's scrollTop is set accordingly. A flag prevents the
    // resulting scroll events on target panes from re-entering this sync
    // and creating a feedback loop.
    const editorOf = useCallback(
        (pane: Pane): monaco.editor.IStandaloneCodeEditor | null => {
            if (pane === 'ours') return leftEditor
            if (pane === 'result') return centerEditor
            return rightEditor
        },
        [leftEditor, centerEditor, rightEditor]
    )

    useEffect(() => {
        if (!editorsReady) return
        const panes: Pane[] = ['ours', 'result', 'theirs']

        const onScroll = (sourcePane: Pane) => {
            if (syncingRef.current) return
            const srcEditor = editorOf(sourcePane)
            if (!srcEditor) return
            syncingRef.current = true
            try {
                const lineHeight = srcEditor.getOption(
                    monaco.editor.EditorOption.lineHeight
                )
                const srcScroll = srcEditor.getScrollTop()
                const srcLineFloat = srcScroll / Math.max(lineHeight, 1)
                const srcLineInt = Math.max(1, Math.floor(srcLineFloat) + 1)
                const fraction = srcLineFloat - Math.floor(srcLineFloat)

                for (const target of panes) {
                    if (target === sourcePane) continue
                    const tgtEditor = editorOf(target)
                    if (!tgtEditor) continue
                    const tgtLine = mapLine(
                        sourcePane,
                        target,
                        srcLineInt,
                        chunkMaps
                    )
                    const tgtLineHeight = tgtEditor.getOption(
                        monaco.editor.EditorOption.lineHeight
                    )
                    const tgtScroll = Math.max(
                        0,
                        (tgtLine - 1 + fraction) * tgtLineHeight
                    )
                    tgtEditor.setScrollTop(
                        tgtScroll,
                        monaco.editor.ScrollType.Immediate
                    )
                }
            } finally {
                syncingRef.current = false
            }
        }

        const disposables = panes.map((p) =>
            editorOf(p)!.onDidScrollChange(() => onScroll(p))
        )
        return () => disposables.forEach((d) => d.dispose())
    }, [editorsReady, chunkMaps, editorOf])

    // Track pane container height for the gutter SVG sizing.
    useEffect(() => {
        if (!containerRef.current) return
        const el = containerRef.current
        const update = () => setPaneHeight(el.clientHeight || 300)
        update()
        const ro = new ResizeObserver(update)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    const handleEditorMounted = useCallback(() => {
        setEditorsMounted((n) => n + 1)
    }, [])

    const navigateConflict = (direction: 1 | -1) => {
        if (totalConflicts === 0) return
        const next = Math.max(
            0,
            Math.min(totalConflicts - 1, currentConflictIdx + direction)
        )
        setCurrentConflictIdx(next)
        const chunk = conflictChunks[next]
        if (!chunk) return
        const fullIdx = chunks.indexOf(chunk)
        const map = chunkMaps[fullIdx]
        if (!map) return
        leftRef.current?.getEditor()?.revealLineInCenter(map.ours.start)
        centerRef.current?.getEditor()?.revealLineInCenter(map.result.start)
        rightRef.current?.getEditor()?.revealLineInCenter(map.theirs.start)
    }

    const handleDecision = (
        chunkIndex: number,
        side: 'ours' | 'theirs',
        decision: SideDecision
    ) => {
        onChunkDecision(chunkIndex, side, decision)
    }

    const autoResolve = () => {
        chunks.forEach((c, i) => {
            if (c.type === 'non-conflicting' && !isChunkResolved(c)) {
                const winner = c.winner ?? 'ours'
                onChunkDecision(i, 'ours', winner === 'ours' ? 'accept' : 'discard')
                onChunkDecision(i, 'theirs', winner === 'theirs' ? 'accept' : 'discard')
            }
        })
    }

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

            <div
                ref={containerRef}
                style={{
                    display: 'flex',
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                }}
            >
                <div
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
                        onMount={handleEditorMounted}
                    />
                </div>
                <div
                    style={{
                        width: GUTTER_WIDTH,
                        flexShrink: 0,
                        flexGrow: 0,
                        position: 'relative',
                        overflow: 'hidden',
                        borderLeft: '1px solid rgba(255,255,255,0.06)',
                        borderRight: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <GutterConnector
                        chunks={chunks}
                        chunkMaps={chunkMaps}
                        leftEditor={leftEditor}
                        rightEditor={centerEditor}
                        leftPane="ours"
                        rightPane="result"
                        width={GUTTER_WIDTH}
                        height={paneHeight}
                        side="left"
                        onDecision={handleDecision}
                    />
                </div>
                <div
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
                        onMount={handleEditorMounted}
                    />
                </div>
                <div
                    style={{
                        width: GUTTER_WIDTH,
                        flexShrink: 0,
                        flexGrow: 0,
                        position: 'relative',
                        overflow: 'hidden',
                        borderLeft: '1px solid rgba(255,255,255,0.06)',
                        borderRight: '1px solid rgba(255,255,255,0.06)',
                    }}
                >
                    <GutterConnector
                        chunks={chunks}
                        chunkMaps={chunkMaps}
                        leftEditor={centerEditor}
                        rightEditor={rightEditor}
                        leftPane="result"
                        rightPane="theirs"
                        width={GUTTER_WIDTH}
                        height={paneHeight}
                        side="right"
                        onDecision={handleDecision}
                    />
                </div>
                <div
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
                        onMount={handleEditorMounted}
                    />
                </div>
            </div>
        </div>
    )
}
