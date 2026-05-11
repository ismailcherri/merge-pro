import * as monaco from 'monaco-editor'
import { useEffect, useRef, useState } from 'react'

interface Props {
    editor: monaco.editor.IStandaloneCodeEditor | null
    width: number
    height: number
    align: 'left' | 'right'
}

/**
 * Renders a vertical strip of line numbers aligned to an editor's visible
 * lines. The strip is positioned absolutely inside its container and scrolls
 * in lockstep with the editor (via `top` offsets). Only the visible window
 * plus a small overscan is rendered.
 */
export function LineNumberStrip({ editor, width, height, align }: Props) {
    const rootRef = useRef<HTMLDivElement>(null)
    const rafRef = useRef<number | null>(null)
    const [tick, setTick] = useState(0)

    useEffect(() => {
        if (!editor) return

        const schedule = () => {
            if (rafRef.current != null) return
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null
                setTick((t) => (t + 1) & 0xffff)
            })
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
