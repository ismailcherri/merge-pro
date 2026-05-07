import * as monaco from 'monaco-editor'
import { useEffect, useMemo, useRef } from 'react'
import type { ConflictChunk } from '../../src/protocol'
import type { ChunkLineMap } from './buildDisplayDocuments'
import type { Pane } from './lineMapping'

interface Props {
    chunks: ConflictChunk[]
    chunkMaps: ChunkLineMap[]
    /** Editor on the left side of this gutter. */
    leftEditor: monaco.editor.IStandaloneCodeEditor | null
    /** Editor on the right side of this gutter. */
    rightEditor: monaco.editor.IStandaloneCodeEditor | null
    /** Which pane the left editor represents. */
    leftPane: Pane
    /** Which pane the right editor represents. */
    rightPane: Pane
    width: number
    height: number
    /** Which arrow direction the accept button should display ("<<" or ">>"). */
    side: 'left' | 'right'
    onAccept?: (chunkIndex: number) => void
}

const FILL_CONFLICT = 'rgba(188,63,60,0.22)'
const STROKE_CONFLICT = 'rgba(220,80,70,0.55)'
const FILL_NONCONFLICT = 'rgba(98,178,98,0.18)'
const STROKE_NONCONFLICT = 'rgba(98,178,98,0.4)'
const FILL_RESOLVED = 'rgba(78,201,176,0.18)'
const STROKE_RESOLVED = 'rgba(78,201,176,0.45)'

const BTN_W = 26
const BTN_H = 16
const BTN_PAD = 3

interface ChunkVisual {
    chunkIndex: number
    isConflict: boolean
    isResolved: boolean
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
    side,
    onAccept,
}: Props) {
    const pathRefs = useRef<(SVGPathElement | null)[]>([])
    const buttonRefs = useRef<(SVGGElement | null)[]>([])
    const rafRef = useRef<number | null>(null)

    const visuals: ChunkVisual[] = useMemo(
        () =>
            chunks.map((c, i) => ({
                chunkIndex: i,
                isConflict: c.type === 'conflict' && c.resolvedWith === undefined,
                isResolved: c.resolvedWith !== undefined,
            })),
        [chunks]
    )

    // Imperatively recompute every chunk's path `d` and button transform.
    // Driven by editor scroll events so we don't re-render React on scroll.
    useEffect(() => {
        if (!leftEditor || !rightEditor) return

        const update = () => {
            rafRef.current = null
            const leftScroll = leftEditor.getScrollTop()
            const rightScroll = rightEditor.getScrollTop()

            for (let i = 0; i < chunks.length; i++) {
                const map = chunkMaps[i]
                const path = pathRefs.current[i]
                const btn = buttonRefs.current[i]
                if (!map || !path) continue

                const leftRange = map[leftPane]
                const rightRange = map[rightPane]

                const lTop =
                    leftEditor.getTopForLineNumber(leftRange.start) - leftScroll
                const lBot =
                    leftEditor.getTopForLineNumber(leftRange.end + 1) -
                    leftScroll
                const rTop =
                    rightEditor.getTopForLineNumber(rightRange.start) -
                    rightScroll
                const rBot =
                    rightEditor.getTopForLineNumber(rightRange.end + 1) -
                    rightScroll

                // Cull if neither side has any portion within the viewport.
                const leftOnScreen = lBot >= 0 && lTop <= height
                const rightOnScreen = rBot >= 0 && rTop <= height
                if (!leftOnScreen && !rightOnScreen) {
                    path.style.display = 'none'
                    if (btn) btn.style.display = 'none'
                    continue
                }
                path.style.display = ''
                if (btn) btn.style.display = ''

                // Clamp far-offscreen ends to a small overhang to avoid drawing
                // extreme shapes that the browser must rasterize across huge
                // distances. We still preserve the slope direction near the
                // viewport.
                const clamp = (v: number) =>
                    Math.max(-200, Math.min(height + 200, v))
                const lT = clamp(lTop)
                const lB = clamp(lBot)
                const rT = clamp(rTop)
                const rB = clamp(rBot)

                const w = width
                const cx = w / 2

                // Cubic-Bezier S-curves on the two horizontal edges produce
                // IntelliJ's "tongue" trapezoid look.
                const d =
                    `M0,${lT} ` +
                    `C${cx},${lT} ${cx},${rT} ${w},${rT} ` +
                    `L${w},${rB} ` +
                    `C${cx},${rB} ${cx},${lB} 0,${lB} ` +
                    `Z`
                path.setAttribute('d', d)

                if (btn) {
                    // Anchor the accept button to the left or right edge of
                    // the gutter, vertically centered on the *left* (source)
                    // chunk so it tracks the chunk on its origin pane.
                    const btnX =
                        side === 'left' ? w - BTN_W - BTN_PAD : BTN_PAD
                    const chunkH = Math.max(lBot - lTop, BTN_H)
                    const btnY =
                        lTop + Math.max(0, (chunkH - BTN_H) / 2)
                    btn.setAttribute(
                        'transform',
                        `translate(${btnX}, ${btnY})`
                    )
                }
            }
        }

        const schedule = () => {
            if (rafRef.current != null) return
            rafRef.current = requestAnimationFrame(update)
        }

        // Initial position.
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
        side,
    ])

    return (
        <svg
            width={width}
            height={height}
            style={{ display: 'block', width: '100%', height: '100%' }}
            aria-hidden
        >
            {visuals.map((v) => {
                const fill = v.isResolved
                    ? FILL_RESOLVED
                    : v.isConflict
                      ? FILL_CONFLICT
                      : FILL_NONCONFLICT
                const stroke = v.isResolved
                    ? STROKE_RESOLVED
                    : v.isConflict
                      ? STROKE_CONFLICT
                      : STROKE_NONCONFLICT
                return (
                    <g key={`chunk-${v.chunkIndex}`}>
                        <path
                            ref={(el) => {
                                pathRefs.current[v.chunkIndex] = el
                            }}
                            d=""
                            fill={fill}
                            stroke={stroke}
                            strokeWidth={1}
                            style={{ display: 'none' }}
                        />
                        {v.isConflict && (
                            <g
                                ref={(el) => {
                                    buttonRefs.current[v.chunkIndex] = el
                                }}
                                style={{ cursor: 'pointer', display: 'none' }}
                                onClick={() => onAccept?.(v.chunkIndex)}
                            >
                                <rect
                                    width={BTN_W}
                                    height={BTN_H}
                                    rx={3}
                                    fill={
                                        side === 'left'
                                            ? 'rgba(188,63,60,0.65)'
                                            : 'rgba(60,100,188,0.65)'
                                    }
                                    stroke={
                                        side === 'left'
                                            ? 'rgba(220,80,70,0.95)'
                                            : 'rgba(70,120,220,0.95)'
                                    }
                                    strokeWidth={1}
                                />
                                <text
                                    x={BTN_W / 2}
                                    y={BTN_H * 0.7}
                                    textAnchor="middle"
                                    fontSize={10}
                                    fontFamily="'SF Mono', Consolas, monospace"
                                    fontWeight="bold"
                                    fill="rgba(255,255,255,0.95)"
                                    style={{
                                        userSelect: 'none',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    {side === 'left' ? '«' : '»'}
                                </text>
                            </g>
                        )}
                    </g>
                )
            })}
        </svg>
    )
}
