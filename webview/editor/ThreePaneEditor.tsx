import * as monaco from 'monaco-editor'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    isChunkResolved,
    type ConflictChunk,
    type SideDecision,
} from '../../src/protocol'
import { resolveFile } from '../../src/utils/ConflictResolver'
import {
    buildDisplayDocuments,
    ChunkLineMap,
    LineRange,
} from './buildDisplayDocuments'
import {
    computePaneInlineDecorations,
    type ChunkBaseRange,
} from './computePaneInlineDecorations'
import { DecisionButtons } from './DecisionButtons'
import { EditorPane, EditorPaneHandle } from './EditorPane'
import { GutterConnector } from './GutterConnector'
import { mapLine, Pane } from './lineMapping'
import { LineNumberStrip } from './LineNumberStrip'
import { MagicWandColumn } from './MagicWandColumn'
import { Toolbar } from './Toolbar'

interface Props {
    oursText: string
    baseText: string
    theirsText: string
    chunks: ConflictChunk[]
    fileName: string
    language: string
    canUndo: boolean
    canRedo: boolean
    onChunkDecision: (
        chunkIndex: number,
        side: 'ours' | 'theirs',
        decision: SideDecision
    ) => void
    onAutoResolve: () => void
    onMagicResolve: () => void
    onMagicResolveChunk: (chunkIndex: number) => void
    onUndo: () => void
    onRedo: () => void
    onSave: (content: string) => void
}

// Layout columns (left → right):
//   ours code | OLN | BTN_L | CONN_L | RLN_L | WAND | result code | RLN_R | CONN_R | BTN_R | TLN | theirs code
const LINENO_WIDTH = 36
const BTN_COL_WIDTH = 42
const CONN_WIDTH = 32
const WAND_WIDTH = 22
const FIXED_WIDTH =
    LINENO_WIDTH * 4 + BTN_COL_WIDTH * 2 + CONN_WIDTH * 2 + WAND_WIDTH
const PANE_WIDTH = `calc((100% - ${FIXED_WIDTH}px) / 3)`

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
    .mp-inline-added   { background: var(--vscode-diffEditor-insertedTextBackground, rgba(98,178,98,0.30)); }
    .mp-inline-removed { background: var(--vscode-diffEditor-removedTextBackground,  rgba(220,80,70,0.30)); }
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
                    range: new monaco.Range(
                        range.start - 1,
                        1,
                        range.start - 1,
                        1
                    ),
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
            className = isResolved
                ? 'merge-result-resolved'
                : 'merge-result-unresolved'
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
    canUndo,
    canRedo,
    onChunkDecision,
    onAutoResolve,
    onMagicResolve,
    onMagicResolveChunk,
    onUndo,
    onRedo,
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
        () =>
            chunks.filter((c) => c.type === 'conflict' && !isChunkResolved(c)),
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

    const chunkBaseRanges = useMemo<ChunkBaseRange[]>(
        () =>
            chunks.map((c) => ({
                start: c.baseStartLine + 1,
                end: c.baseEndLine,
            })),
        [chunks]
    )

    const inlineDecorations = useMemo(
        () =>
            computePaneInlineDecorations({
                ours,
                result,
                theirs,
                baseText,
                chunkMaps,
                chunkBaseRanges,
            }),
        [ours, result, theirs, baseText, chunkMaps, chunkBaseRanges]
    )

    const oursDecorations = useMemo(
        () => [
            ...buildPaneDecorations(chunks, chunkMaps, 'ours'),
            ...(inlineDecorations.ours as monaco.editor.IModelDeltaDecoration[]),
        ],
        [chunks, chunkMaps, inlineDecorations]
    )
    const resultDecorations = useMemo(
        () => [
            ...buildPaneDecorations(chunks, chunkMaps, 'result'),
            ...(inlineDecorations.result as monaco.editor.IModelDeltaDecoration[]),
        ],
        [chunks, chunkMaps, inlineDecorations]
    )
    const theirsDecorations = useMemo(
        () => [
            ...buildPaneDecorations(chunks, chunkMaps, 'theirs'),
            ...(inlineDecorations.theirs as monaco.editor.IModelDeltaDecoration[]),
        ],
        [chunks, chunkMaps, inlineDecorations]
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
                const srcScrollLeft = srcEditor.getScrollLeft()
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
                    // Horizontal scroll has no line-mapping concept — mirror
                    // 1:1. Monaco clamps to each pane's own max scroll width,
                    // so shorter panes simply stop at their own end.
                    tgtEditor.setScrollLeft(
                        srcScrollLeft,
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

    // Global keyboard shortcuts for undo / redo. Use window listener so the
    // shortcut works regardless of which editor pane has focus.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey
            if (!mod) return
            const key = e.key.toLowerCase()
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault()
                onUndo()
            } else if ((key === 'z' && e.shiftKey) || key === 'y') {
                e.preventDefault()
                onRedo()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onUndo, onRedo])

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
                canUndo={canUndo}
                canRedo={canRedo}
                onPrev={() => navigateConflict(-1)}
                onNext={() => navigateConflict(1)}
                onAutoResolve={onAutoResolve}
                onMagicResolve={onMagicResolve}
                onUndo={onUndo}
                onRedo={onRedo}
                onSave={() => {
                    const resultContent = centerRef.current
                        ?.getEditor()
                        ?.getValue()
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
                        width: `calc(${PANE_WIDTH} + ${LINENO_WIDTH + BTN_COL_WIDTH}px)`,
                        padding: '3px 8px',
                        color: '#e07070',
                        background: 'rgba(188,63,60,0.08)',
                    }}
                >
                    Ours
                </div>
                <div style={{ width: CONN_WIDTH }} />
                <div
                    style={{
                        width: `calc(${PANE_WIDTH} + ${LINENO_WIDTH * 2 + WAND_WIDTH}px)`,
                        padding: '3px 8px',
                        color: '#4ec9b0',
                        background: 'rgba(78,201,176,0.04)',
                        textAlign: 'center',
                    }}
                >
                    Result
                </div>
                <div style={{ width: CONN_WIDTH }} />
                <div
                    style={{
                        width: `calc(${PANE_WIDTH} + ${LINENO_WIDTH + BTN_COL_WIDTH}px)`,
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
                {/* 1. Ours code */}
                <div style={paneStyle(PANE_WIDTH)}>
                    <EditorPane
                        ref={leftRef}
                        value={ours}
                        language={language}
                        readOnly
                        decorations={oursDecorations}
                        onMount={handleEditorMounted}
                    />
                </div>

                {/* 2. Ours line numbers (right-aligned, abutting the buttons) */}
                <div style={fixedColStyle(LINENO_WIDTH)}>
                    <LineNumberStrip
                        editor={leftEditor}
                        width={LINENO_WIDTH}
                        height={paneHeight}
                        align="right"
                        chunks={chunks}
                        chunkMaps={chunkMaps}
                        pane="ours"
                    />
                </div>

                {/* 3. Ours decision buttons (×, ») */}
                <div style={fixedColStyle(BTN_COL_WIDTH, true)}>
                    <DecisionButtons
                        chunks={chunks}
                        chunkMaps={chunkMaps}
                        editor={leftEditor}
                        side="ours"
                        pane="ours"
                        width={BTN_COL_WIDTH}
                        height={paneHeight}
                        onDecision={handleDecision}
                    />
                </div>

                {/* 4. Left connector (ours ↔ result) */}
                <div style={fixedColStyle(CONN_WIDTH)}>
                    <GutterConnector
                        chunks={chunks}
                        chunkMaps={chunkMaps}
                        leftEditor={leftEditor}
                        rightEditor={centerEditor}
                        leftPane="ours"
                        rightPane="result"
                        width={CONN_WIDTH}
                        height={paneHeight}
                    />
                </div>

                {/* 5. Result line numbers (left side) */}
                <div style={fixedColStyle(LINENO_WIDTH)}>
                    <LineNumberStrip
                        editor={centerEditor}
                        width={LINENO_WIDTH}
                        height={paneHeight}
                        align="right"
                        chunks={chunks}
                        chunkMaps={chunkMaps}
                        pane="result"
                    />
                </div>

                {/* 5b. Magic-wand column: per-chunk auto-merge action */}
                <div style={fixedColStyle(WAND_WIDTH)}>
                    <MagicWandColumn
                        chunks={chunks}
                        chunkMaps={chunkMaps}
                        editor={centerEditor}
                        width={WAND_WIDTH}
                        height={paneHeight}
                        onMagicChunk={onMagicResolveChunk}
                    />
                </div>

                {/* 6. Result code */}
                <div style={paneStyle(PANE_WIDTH)}>
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

                {/* 7. Result line numbers (right side) */}
                <div style={fixedColStyle(LINENO_WIDTH)}>
                    <LineNumberStrip
                        editor={centerEditor}
                        width={LINENO_WIDTH}
                        height={paneHeight}
                        align="left"
                        chunks={chunks}
                        chunkMaps={chunkMaps}
                        pane="result"
                    />
                </div>

                {/* 8. Right connector (result ↔ theirs) */}
                <div style={fixedColStyle(CONN_WIDTH)}>
                    <GutterConnector
                        chunks={chunks}
                        chunkMaps={chunkMaps}
                        leftEditor={centerEditor}
                        rightEditor={rightEditor}
                        leftPane="result"
                        rightPane="theirs"
                        width={CONN_WIDTH}
                        height={paneHeight}
                    />
                </div>

                {/* 9. Theirs decision buttons («, ×) */}
                <div style={fixedColStyle(BTN_COL_WIDTH, true)}>
                    <DecisionButtons
                        chunks={chunks}
                        chunkMaps={chunkMaps}
                        editor={rightEditor}
                        side="theirs"
                        pane="theirs"
                        width={BTN_COL_WIDTH}
                        height={paneHeight}
                        onDecision={handleDecision}
                    />
                </div>

                {/* 10. Theirs line numbers (left-aligned, abutting the buttons) */}
                <div style={fixedColStyle(LINENO_WIDTH)}>
                    <LineNumberStrip
                        editor={rightEditor}
                        width={LINENO_WIDTH}
                        height={paneHeight}
                        align="left"
                        chunks={chunks}
                        chunkMaps={chunkMaps}
                        pane="theirs"
                    />
                </div>

                {/* 11. Theirs code */}
                <div style={paneStyle(PANE_WIDTH)}>
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

function paneStyle(width: string) {
    return {
        width,
        height: '100%',
        overflow: 'hidden',
        flexShrink: 0,
        position: 'relative' as const,
    }
}

function fixedColStyle(width: number, withBorders = false) {
    return {
        width,
        flexShrink: 0,
        flexGrow: 0,
        position: 'relative' as const,
        overflow: 'hidden',
        ...(withBorders
            ? {
                  borderLeft: '1px solid rgba(255,255,255,0.06)',
                  borderRight: '1px solid rgba(255,255,255,0.06)',
              }
            : {}),
    }
}
