import * as monaco from 'monaco-editor'
import { useEffect, useMemo, useRef } from 'react'
import { isChunkResolved, type ConflictChunk } from '../../src/protocol'
import type { ChunkLineMap } from './buildDisplayDocuments'
import { CHUNK_FILL } from './chunkColors'
import type { Pane } from './lineMapping'

interface Props {
    chunks: ConflictChunk[]
    chunkMaps: ChunkLineMap[]
    leftEditor: monaco.editor.IStandaloneCodeEditor | null
    rightEditor: monaco.editor.IStandaloneCodeEditor | null
    leftPane: Pane
    rightPane: Pane
    width: number
    height: number
}

// When a chunk has zero lines on one side (pure insertion/deletion), the
// connector would collapse to a single point on that side. Splay it out
// slightly so the wedge stays visible and lines up with the thin in-editor
// marker drawn at the insertion row.
const MIN_TIP_HEIGHT = 2

interface ChunkVisual {
    chunkIndex: number
    isConflict: boolean
    isResolved: boolean
    isPartial: boolean
}

function fillForVisual(v: ChunkVisual): string {
    if (v.isResolved) return CHUNK_FILL.resolved
    if (v.isPartial) return CHUNK_FILL.partial
    if (v.isConflict) return CHUNK_FILL.conflict
    return CHUNK_FILL.nonConflicting
}

export function GutterConnector({
    chunks,
    chunkMaps,
    leftEditor,
    rightEditor,
    leftPane,
    rightPane,
    width,
    height,
}: Readonly<Props>) {
    const pathRefs = useRef<(SVGPathElement | null)[]>([])
    const rafRef = useRef<number | null>(null)

    const visuals: ChunkVisual[] = useMemo(
        () =>
            chunks.map((c, i) => {
                const resolved = isChunkResolved(c)
                const anyDecision =
                    c.oursDecision !== undefined ||
                    c.theirsDecision !== undefined
                return {
                    chunkIndex: i,
                    isConflict: c.type === 'conflict' && !resolved,
                    isResolved: resolved,
                    isPartial: !resolved && anyDecision,
                }
            }),
        [chunks]
    )

    useEffect(() => {
        if (!leftEditor || !rightEditor) return

        const update = () => {
            rafRef.current = null
            const leftScroll = leftEditor.getScrollTop()
            const rightScroll = rightEditor.getScrollTop()

            for (let i = 0; i < chunks.length; i++) {
                const map = chunkMaps[i]
                const path = pathRefs.current[i]
                if (!map || !path) continue

                const leftRange = map[leftPane]
                const rightRange = map[rightPane]

                let lTop =
                    leftEditor.getTopForLineNumber(leftRange.start) - leftScroll
                let lBot =
                    leftEditor.getTopForLineNumber(leftRange.end + 1) -
                    leftScroll
                let rTop =
                    rightEditor.getTopForLineNumber(rightRange.start) -
                    rightScroll
                let rBot =
                    rightEditor.getTopForLineNumber(rightRange.end + 1) -
                    rightScroll

                if (lBot - lTop < MIN_TIP_HEIGHT) {
                    const half = MIN_TIP_HEIGHT / 2
                    lTop -= half
                    lBot += half
                }
                if (rBot - rTop < MIN_TIP_HEIGHT) {
                    const half = MIN_TIP_HEIGHT / 2
                    rTop -= half
                    rBot += half
                }

                const leftOnScreen = lBot >= 0 && lTop <= height
                const rightOnScreen = rBot >= 0 && rTop <= height
                if (!leftOnScreen && !rightOnScreen) {
                    path.style.display = 'none'
                    continue
                }
                path.style.display = ''

                const clamp = (v: number) =>
                    Math.max(-200, Math.min(height + 200, v))
                const lT = clamp(lTop)
                const lB = clamp(lBot)
                const rT = clamp(rTop)
                const rB = clamp(rBot)

                const w = width
                const cx = w / 2

                const d =
                    `M0,${lT} ` +
                    `C${cx},${lT} ${cx},${rT} ${w},${rT} ` +
                    `L${w},${rB} ` +
                    `C${cx},${rB} ${cx},${lB} 0,${lB} ` +
                    `Z`
                path.setAttribute('d', d)
            }
        }

        const schedule = () => {
            if (rafRef.current != null) return
            rafRef.current = requestAnimationFrame(update)
        }

        schedule()

        const dl = leftEditor.onDidScrollChange(schedule)
        const dr = rightEditor.onDidScrollChange(schedule)
        const dlc = leftEditor.onDidContentSizeChange(schedule)
        const drc = rightEditor.onDidContentSizeChange(schedule)
        const dll = leftEditor.onDidLayoutChange(schedule)
        const drl = rightEditor.onDidLayoutChange(schedule)

        return () => {
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = null
            }
            dl.dispose()
            dr.dispose()
            dlc.dispose()
            drc.dispose()
            dll.dispose()
            drl.dispose()
        }
    }, [
        chunks,
        chunkMaps,
        leftEditor,
        rightEditor,
        leftPane,
        rightPane,
        width,
        height,
    ])

    return (
        <svg
            width={width}
            height={height}
            style={{ display: 'block', width: '100%', height: '100%' }}
        >
            {visuals.map((v) => {
                const fill = fillForVisual(v)
                return (
                    <path
                        key={`chunk-${v.chunkIndex}`}
                        ref={(el) => {
                            pathRefs.current[v.chunkIndex] = el
                        }}
                        d=""
                        style={{ display: 'none', fill }}
                    />
                )
            })}
        </svg>
    )
}
