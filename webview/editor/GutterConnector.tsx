import * as monaco from 'monaco-editor'
import { useEffect, useMemo, useRef } from 'react'
import {
    isChunkResolved,
    singleChangedSide,
    type ConflictChunk,
    type SideDecision,
} from '../../src/protocol'
import type { ChunkLineMap } from './buildDisplayDocuments'
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
    /** Which side ('ours' or 'theirs') this gutter's buttons control. */
    side: 'left' | 'right'
    onDecision?: (
        chunkIndex: number,
        side: 'ours' | 'theirs',
        decision: SideDecision
    ) => void
}

const FILL_CONFLICT = 'rgba(188,63,60,0.22)'
const FILL_NONCONFLICT = 'rgba(98,178,98,0.18)'
const FILL_RESOLVED = 'rgba(78,201,176,0.18)'
const FILL_PARTIAL = 'rgba(188,63,60,0.12)'

const BTN_W = 18
const BTN_H = 16
const BTN_GAP = 2
const BTN_PAD = 3

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
    onDecision,
}: Props) {
    const pathRefs = useRef<(SVGPathElement | null)[]>([])
    const buttonGroupRefs = useRef<(SVGGElement | null)[]>([])
    const rafRef = useRef<number | null>(null)

    /** Side this gutter's buttons act on — Ours gutter targets ours decisions; Theirs gutter targets theirs. */
    const decisionSide: 'ours' | 'theirs' = side === 'left' ? 'ours' : 'theirs'

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
                const btn = buttonGroupRefs.current[i]
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

                // Splay zero-height tips so the connector visibly tapers
                // into the thin in-editor marker rather than collapsing to
                // a point.
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
                    if (btn) btn.style.display = 'none'
                    continue
                }
                path.style.display = ''
                if (btn) btn.style.display = ''

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

                if (btn) {
                    const groupW = BTN_W * 2 + BTN_GAP
                    const btnX =
                        side === 'left' ? w - groupW - BTN_PAD : BTN_PAD
                    const chunkH = Math.max(lBot - lTop, BTN_H)
                    const btnY = lTop + Math.max(0, (chunkH - BTN_H) / 2)
                    btn.setAttribute('transform', `translate(${btnX}, ${btnY})`)
                }
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
        side,
    ])

    const acceptArrow = side === 'left' ? '»' : '«'

    return (
        <svg
            width={width}
            height={height}
            style={{ display: 'block', width: '100%', height: '100%' }}
        >
            {visuals.map((v) => {
                const fill = v.isResolved
                    ? FILL_RESOLVED
                    : v.isPartial
                      ? FILL_PARTIAL
                      : v.isConflict
                        ? FILL_CONFLICT
                        : FILL_NONCONFLICT
                const chunk = chunks[v.chunkIndex]
                const sideDecision =
                    decisionSide === 'ours'
                        ? chunk.oursDecision
                        : chunk.theirsDecision
                // Hide buttons on the side that didn't change — there's
                // nothing for the user to accept or discard there. Matches
                // IntelliJ's one-sided change behavior.
                const single = singleChangedSide(chunk)
                const sideHasChange = single === null || single === decisionSide
                const showButtons = !v.isResolved && sideHasChange
                // Order buttons so accept is on the inner edge (closer to result).
                // Left gutter: [X][«]   Right gutter: [»][X]
                const acceptIdx = side === 'left' ? 1 : 0
                const discardIdx = side === 'left' ? 0 : 1

                const acceptOpacity = sideDecision === 'discard' ? 0.35 : 1
                const discardOpacity = sideDecision === 'accept' ? 0.35 : 1

                return (
                    <g key={`chunk-${v.chunkIndex}`}>
                        <path
                            ref={(el) => {
                                pathRefs.current[v.chunkIndex] = el
                            }}
                            d=""
                            fill={fill}
                            style={{ display: 'none' }}
                        />
                        {showButtons && (
                            <g
                                ref={(el) => {
                                    buttonGroupRefs.current[v.chunkIndex] = el
                                }}
                                style={{ display: 'none' }}
                            >
                                <g
                                    transform={`translate(${acceptIdx * (BTN_W + BTN_GAP)}, 0)`}
                                    style={{
                                        cursor: 'pointer',
                                        opacity: acceptOpacity,
                                    }}
                                    onClick={() =>
                                        onDecision?.(
                                            v.chunkIndex,
                                            decisionSide,
                                            'accept'
                                        )
                                    }
                                >
                                    <title>
                                        Accept this side&apos;s change
                                    </title>
                                    <rect
                                        width={BTN_W}
                                        height={BTN_H}
                                        rx={3}
                                        fill="transparent"
                                    />
                                    <text
                                        x={BTN_W / 2}
                                        y={BTN_H * 0.72}
                                        textAnchor="middle"
                                        fontSize={11}
                                        fontFamily="'SF Mono', Consolas, monospace"
                                        fontWeight="bold"
                                        fill="rgba(255,255,255,0.95)"
                                        style={{
                                            userSelect: 'none',
                                            pointerEvents: 'none',
                                        }}
                                    >
                                        {acceptArrow}
                                    </text>
                                </g>
                                <g
                                    transform={`translate(${discardIdx * (BTN_W + BTN_GAP)}, 0)`}
                                    style={{
                                        cursor: 'pointer',
                                        opacity: discardOpacity,
                                    }}
                                    onClick={() =>
                                        onDecision?.(
                                            v.chunkIndex,
                                            decisionSide,
                                            'discard'
                                        )
                                    }
                                >
                                    <title>
                                        Discard this side&apos;s change
                                    </title>
                                    <rect
                                        width={BTN_W}
                                        height={BTN_H}
                                        rx={3}
                                        fill="transparent"
                                    />
                                    <text
                                        x={BTN_W / 2}
                                        y={BTN_H * 0.72}
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
                                        x
                                    </text>
                                </g>
                            </g>
                        )}
                    </g>
                )
            })}
        </svg>
    )
}
