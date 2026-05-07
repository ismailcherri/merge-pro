import { useMemo } from 'react'
import type { ConflictChunk } from '../../src/protocol'
import type { DisplayRange } from './buildDisplayDocuments'

interface Props {
    chunks: ConflictChunk[]
    displayRanges: DisplayRange[]
    getTop: (line: number) => number
    height: number
    width: number
    scrollTop: number
    side: 'left' | 'right'
    onAcceptOurs?: (chunkIndex: number) => void
    onAcceptTheirs?: (chunkIndex: number) => void
}

const COLORS = {
    'non-conflicting': {
        fill: 'rgba(98,178,98,0.15)',
        stroke: 'rgba(98,178,98,0.35)',
    },
    conflict: { fill: 'rgba(160,100,40,0.2)', stroke: 'rgba(180,110,40,0.55)' },
    resolved: { fill: 'rgba(78,201,176,0.15)', stroke: 'rgba(78,201,176,0.5)' },
}

const BTN_H = 16
const BTN_W = 26
const BTN_MARGIN = 3

export function GutterConnector({
    chunks,
    displayRanges,
    getTop,
    height,
    width,
    scrollTop,
    side,
    onAcceptOurs,
    onAcceptTheirs,
}: Props) {
    const elements = useMemo(() => {
        return chunks.map((chunk, i) => {
            const range = displayRanges[i]
            if (!range) return null

            const top = getTop(range.start) - scrollTop
            const bottom = getTop(range.end + 1) - scrollTop

            if (bottom <= top || bottom < -height || top > height * 2) return null

            const isResolved = chunk.resolvedWith !== undefined
            const isConflict = chunk.type === 'conflict' && !isResolved
            const colorKey = isResolved ? 'resolved' : chunk.type
            const baseColor =
                COLORS[colorKey as keyof typeof COLORS] ?? COLORS.conflict

            const onAccept = () =>
                side === 'left' ? onAcceptOurs?.(i) : onAcceptTheirs?.(i)
            const btnLabel = side === 'left' ? '<<' : '>>'
            const btnX = side === 'left'
                ? width - BTN_W - BTN_MARGIN
                : BTN_MARGIN

            return (
                <g key={`${range.start}-${range.end}`}>
                    {/* Background connector rectangle */}
                    <rect
                        x={0}
                        y={top}
                        width={width}
                        height={Math.max(bottom - top, 1)}
                        fill={baseColor.fill}
                        stroke={baseColor.stroke}
                        strokeWidth={1}
                    />

                    {/* Accept action button for unresolved conflicts */}
                    {isConflict && (
                        <g
                            onClick={onAccept}
                            style={{ cursor: 'pointer' }}
                            onMouseEnter={(e) => {
                                const rect = e.currentTarget.querySelector('rect')
                                if (rect) rect.setAttribute('fill', 'rgba(255,255,255,0.2)')
                            }}
                            onMouseLeave={(e) => {
                                const rect = e.currentTarget.querySelector('rect')
                                if (rect) rect.setAttribute('fill', 'rgba(255,255,255,0.08)')
                            }}
                        >
                            <rect
                                x={btnX}
                                y={top + BTN_MARGIN}
                                width={BTN_W}
                                height={BTN_H}
                                rx={3}
                                fill="rgba(255,255,255,0.08)"
                                stroke="rgba(255,255,255,0.25)"
                                strokeWidth={1}
                            />
                            <text
                                x={btnX + BTN_W / 2}
                                y={top + BTN_MARGIN + BTN_H * 0.72}
                                textAnchor="middle"
                                fontSize={9}
                                fontFamily="monospace"
                                fill="rgba(255,255,255,0.85)"
                                style={{ pointerEvents: 'none', userSelect: 'none' }}
                            >
                                {btnLabel}
                            </text>
                        </g>
                    )}
                </g>
            )
        })
    }, [chunks, displayRanges, getTop, width, height, scrollTop, side, onAcceptOurs, onAcceptTheirs])

    return (
        <svg
            width={width}
            height={height}
            style={{ display: 'block', flexShrink: 0, overflow: 'visible' }}
            aria-hidden
        >
            {elements}
        </svg>
    )
}
