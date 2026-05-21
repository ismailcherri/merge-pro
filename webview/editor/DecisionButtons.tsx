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
    /** Editor whose scroll position drives Y placement (the code pane this column is attached to). */
    editor: monaco.editor.IStandaloneCodeEditor | null
    /** Which side this column controls. */
    side: 'ours' | 'theirs'
    /** Which Monaco line range to use for vertical placement. */
    pane: Pane
    width: number
    height: number
    onDecision?: (
        chunkIndex: number,
        side: 'ours' | 'theirs',
        decision: SideDecision
    ) => void
}

const BTN_W = 18
const BTN_H = 16
const BTN_GAP = 2
const BTN_TOP_PAD = 2

// Mirror GutterConnector's fill palette so the chunk band visually continues
// from the connector strip through this column.
const FILL_CONFLICT = 'rgba(188,63,60,0.22)'
const FILL_NONCONFLICT = 'rgba(98,178,98,0.18)'
const FILL_RESOLVED = 'rgba(78,201,176,0.18)'
const FILL_PARTIAL = 'rgba(188,63,60,0.12)'
const MIN_TIP_HEIGHT = 2

export interface ChunkVisual {
    chunkIndex: number
    isConflict: boolean
    isResolved: boolean
    isPartial: boolean
}

export function fillForVisual(v: ChunkVisual): string {
    if (v.isResolved) return FILL_RESOLVED
    if (v.isPartial) return FILL_PARTIAL
    if (v.isConflict) return FILL_CONFLICT
    return FILL_NONCONFLICT
}

export function showBand(band: SVGRectElement, top: number, bot: number): void {
    band.style.display = ''
    band.setAttribute('y', String(top))
    band.setAttribute('height', String(Math.max(0, bot - top)))
}

export function hideBand(band: SVGRectElement): void {
    band.style.display = 'none'
}

export function showButtons(
    grp: SVGGElement,
    top: number,
    bot: number,
    width: number
): void {
    grp.style.display = ''
    const groupW = BTN_W * 2 + BTN_GAP
    const btnX = (width - groupW) / 2
    // Pin to the top of the chunk so multi-line chunks anchor the controls
    // where the change starts. Clamp so the buttons don't fall off the bottom
    // for very short ranges (e.g. zero-line insertions).
    const btnY = Math.min(top + BTN_TOP_PAD, Math.max(top, bot - BTN_H))
    grp.setAttribute('transform', `translate(${btnX}, ${btnY})`)
}

export function hideButtons(grp: SVGGElement): void {
    grp.style.display = 'none'
}

export function DecisionButtons({
    chunks,
    chunkMaps,
    editor,
    side,
    pane,
    width,
    height,
    onDecision,
}: Readonly<Props>) {
    const groupRefs = useRef<(SVGGElement | null)[]>([])
    const bandRefs = useRef<(SVGRectElement | null)[]>([])
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
        if (!editor) return

        const update = () => {
            rafRef.current = null
            const scroll = editor.getScrollTop()

            for (let i = 0; i < chunks.length; i++) {
                const map = chunkMaps[i]
                const grp = groupRefs.current[i]
                const band = bandRefs.current[i]
                if (!map) continue

                const range = map[pane]
                let top = editor.getTopForLineNumber(range.start) - scroll
                let bot = editor.getTopForLineNumber(range.end + 1) - scroll
                // Empty range (insertion on the other side): splay so the
                // band remains a visible thin strip, matching the connector.
                if (bot - top < MIN_TIP_HEIGHT) {
                    const half = MIN_TIP_HEIGHT / 2
                    top -= half
                    bot += half
                }

                const onScreen = bot >= 0 && top <= height
                if (band) {
                    if (onScreen) showBand(band, top, bot)
                    else hideBand(band)
                }
                if (grp) {
                    if (onScreen) showButtons(grp, top, bot, width)
                    else hideButtons(grp)
                }
            }
        }

        const schedule = () => {
            if (rafRef.current != null) return
            rafRef.current = requestAnimationFrame(update)
        }

        schedule()
        const ds = editor.onDidScrollChange(schedule)
        const dc = editor.onDidContentSizeChange(schedule)
        const dl = editor.onDidLayoutChange(schedule)

        return () => {
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = null
            }
            ds.dispose()
            dc.dispose()
            dl.dispose()
        }
    }, [chunks, chunkMaps, editor, pane, height, width])

    const acceptArrow = side === 'ours' ? '»' : '«'

    return (
        <svg
            width={width}
            height={height}
            style={{ display: 'block', width: '100%', height: '100%' }}
        >
            {visuals.map((v) => {
                const fill = fillForVisual(v)
                const chunk = chunks[v.chunkIndex]
                const sideDecision =
                    side === 'ours' ? chunk.oursDecision : chunk.theirsDecision
                const single = singleChangedSide(chunk)
                const sideHasChange = single === null || single === side
                const showButtons = !v.isResolved && sideHasChange
                // Accept on the inner edge (closer to result), discard on the outer edge.
                // Ours column:  [×][»]   Theirs column: [«][×]
                const acceptIdx = side === 'ours' ? 1 : 0
                const discardIdx = side === 'ours' ? 0 : 1
                const acceptOpacity = sideDecision === 'discard' ? 0.35 : 1
                const discardOpacity = sideDecision === 'accept' ? 0.35 : 1

                return (
                    <g key={`btn-${v.chunkIndex}`}>
                        <rect
                            ref={(el) => {
                                bandRefs.current[v.chunkIndex] = el
                            }}
                            x={0}
                            y={0}
                            width={width}
                            height={0}
                            fill={fill}
                            style={{ display: 'none' }}
                        />
                        {showButtons && (
                            <g
                                ref={(el) => {
                                    groupRefs.current[v.chunkIndex] = el
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
                                            side,
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
                                            side,
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
