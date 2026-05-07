import * as monaco from 'monaco-editor'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ConflictChunk } from '../../src/protocol'
import { resolveFile } from '../../src/utils/ConflictResolver'
import { EditorPane, EditorPaneHandle } from './EditorPane'
import { GutterConnector } from './GutterConnector'
import { Toolbar } from './Toolbar'
import { buildDisplayDocuments } from './buildDisplayDocuments'

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
const PANE_WIDTH = `calc((100% - ${GUTTER_WIDTH * 2}px) / 3)`

if (typeof document !== 'undefined') {
    const style = document.createElement('style')
    style.textContent = `
    .merge-chunk-non-conflicting { background: rgba(98,178,98,0.12); }
    .merge-chunk-conflict        { background: rgba(160,100,40,0.18); }
    .merge-chunk-resolved        { background: rgba(78,201,176,0.12); }
  `
    document.head.appendChild(style)
}

function decorationsForPane(
    chunks: ConflictChunk[]
): monaco.editor.IModelDeltaDecoration[] {
    return chunks.map((chunk) => ({
        range: new monaco.Range(
            chunk.baseStartLine + 1,
            1,
            chunk.baseEndLine + 1,
            1
        ),
        options: {
            isWholeLine: true,
            className: `merge-chunk-${chunk.resolvedWith !== undefined ? 'resolved' : chunk.type}`,
        },
    }))
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

    const conflictChunks = chunks.filter(
        (c) => c.type === 'conflict' && c.resolvedWith === undefined
    )
    const totalConflicts = conflictChunks.length

    const displayDocs = useMemo(
        () => buildDisplayDocuments(baseText, chunks),
        [baseText, chunks]
    )

    const decorations = useMemo(() => decorationsForPane(chunks), [chunks])

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

    // Re-render once all three editors have mounted, so gutters get valid getTop references
    const handleEditorMounted = useCallback(() => {
        setEditorsMounted((n) => n + 1)
    }, [])

    const getTop = useCallback(
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
        if (chunk) {
            const line = chunk.baseStartLine + 1
            leftRef.current?.getEditor()?.revealLineInCenter(line)
            centerRef.current?.getEditor()?.revealLineInCenter(line)
        }
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

    // Force gutter recalculation after editors mount
    const editorsReady =
        editorsMounted >= 3 && leftRef.current?.getEditor() != null

    const leftEditor = editorsReady ? leftRef.current!.getEditor()! : null
    const centerEditor = editorsReady ? centerRef.current!.getEditor()! : null
    const rightEditor = editorsReady ? rightRef.current!.getEditor()! : null

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
                    const resultContent = centerRef.current
                        ?.getEditor()
                        ?.getValue()
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
                        color: '#9cdcfe',
                        background: 'rgba(0,122,204,0.06)',
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
                        color: '#c586c0',
                        background: 'rgba(197,134,192,0.06)',
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
                        value={displayDocs.ours}
                        language={language}
                        readOnly
                        decorations={decorations}
                        onDidScrollChange={handleScroll}
                        onMount={handleEditorMounted}
                    />
                </div>
                <GutterConnector
                    chunks={chunks}
                    leftGetTop={getTop(leftEditor)}
                    rightGetTop={getTop(centerEditor)}
                    height={
                        leftEditor?.getContainerDomNode()?.clientHeight ?? 300
                    }
                    width={GUTTER_WIDTH}
                    scrollTop={scrollTop}
                    onAcceptOurs={(i) => handleAccept(i, 'ours')}
                />
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
                        value={displayDocs.result}
                        language={language}
                        readOnly={false}
                        decorations={decorations}
                        onDidScrollChange={handleScroll}
                        onMount={handleEditorMounted}
                    />
                </div>
                <GutterConnector
                    chunks={chunks}
                    leftGetTop={getTop(centerEditor)}
                    rightGetTop={getTop(rightEditor)}
                    height={
                        centerEditor?.getContainerDomNode()?.clientHeight ?? 300
                    }
                    width={GUTTER_WIDTH}
                    scrollTop={scrollTop}
                    onAcceptTheirs={(i) => handleAccept(i, 'theirs')}
                />
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
                        value={displayDocs.theirs}
                        language={language}
                        readOnly
                        decorations={decorations}
                        onDidScrollChange={handleScroll}
                        onMount={handleEditorMounted}
                    />
                </div>
            </div>
        </div>
    )
}
