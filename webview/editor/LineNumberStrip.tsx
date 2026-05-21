import * as monaco from 'monaco-editor'
import { useEffect, useRef, useState } from 'react'
import type { ConflictChunk } from '../../src/protocol'
import type { ChunkLineMap } from './buildDisplayDocuments'
import { ChunkBandLayer } from './ChunkBandLayer'
import type { Pane } from './lineMapping'

interface Props {
    editor: monaco.editor.IStandaloneCodeEditor | null
    width: number
    height: number
    align: 'left' | 'right'
    chunks?: ConflictChunk[]
    chunkMaps?: ChunkLineMap[]
    pane?: Pane
}

/**
 * Renders a vertical strip of line numbers aligned to an editor's visible
 * lines. The strip is positioned absolutely inside its container and scrolls
 * in lockstep with the editor (via `top` offsets). Only the visible window
 * plus a small overscan is rendered.
 */
export function LineNumberStrip({
    editor,
    width,
    height,
    align,
    chunks,
    chunkMaps,
    pane,
}: Readonly<Props>) {
    const rootRef = useRef<HTMLDivElement>(null)
    const rafRef = useRef<number | null>(null)
    const [tick, setTick] = useState(0)

    useEffect(() => {
        if (!editor) return

        const onFrame = () => {
            rafRef.current = null
            setTick((t) => (t + 1) & 0xffff)
        }
        const schedule = () => {
            if (rafRef.current != null) return
            rafRef.current = requestAnimationFrame(onFrame)
        }

        schedule()
        const ds = editor.onDidScrollChange(schedule)
        const dc = editor.onDidContentSizeChange(schedule)
        const dl = editor.onDidLayoutChange(schedule)
        const dm = editor.onDidChangeModel(schedule)
        const dmc = editor.onDidChangeModelContent(schedule)

        return () => {
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = null
            }
            ds.dispose()
            dc.dispose()
            dl.dispose()
            dm.dispose()
            dmc.dispose()
        }
    }, [editor])

    if (!editor) {
        return <div ref={rootRef} style={{ width, height }} />
    }

    const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight)
    const scrollTop = editor.getScrollTop()
    const model = editor.getModel()
    const totalLines = model?.getLineCount() ?? 0

    const firstVisible = Math.max(1, Math.floor(scrollTop / lineHeight) - 2)
    const lastVisible = Math.min(
        totalLines,
        Math.ceil((scrollTop + height) / lineHeight) + 2
    )

    const items: { lineNumber: number; top: number }[] = []
    for (let ln = firstVisible; ln <= lastVisible; ln++) {
        items.push({
            lineNumber: ln,
            top: editor.getTopForLineNumber(ln) - scrollTop,
        })
    }

    return (
        <div
            ref={rootRef}
            style={{
                position: 'relative',
                width,
                height,
                overflow: 'hidden',
                userSelect: 'none',
                fontFamily:
                    "var(--vscode-editor-font-family, 'SF Mono', Consolas, monospace)",
                fontSize: 11,
                color: 'rgba(180,180,180,0.55)',
                background: 'transparent',
            }}
            data-tick={tick}
        >
            {chunks && chunkMaps && pane && (
                <ChunkBandLayer
                    chunks={chunks}
                    chunkMaps={chunkMaps}
                    editor={editor}
                    pane={pane}
                    width={width}
                    height={height}
                />
            )}
            {items.map((it) => (
                <div
                    key={it.lineNumber}
                    style={{
                        position: 'absolute',
                        top: it.top,
                        height: lineHeight,
                        lineHeight: `${lineHeight}px`,
                        width: width - 4,
                        left: align === 'right' ? 0 : 4,
                        textAlign: align === 'right' ? 'right' : 'left',
                        paddingRight: align === 'right' ? 4 : 0,
                    }}
                >
                    {it.lineNumber}
                </div>
            ))}
        </div>
    )
}
