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

// Colors for connector bands
const CONFLICT_FILL = 'rgba(188,63,60,0.22)'
const CONFLICT_STROKE = 'rgba(220,80,70,0.55)'
const NONCONFLICT_FILL = 'rgba(98,178,98,0.18)'
const NONCONFLICT_STROKE = 'rgba(98,178,98,0.4)'
const RESOLVED_FILL = 'rgba(78,201,176,0.18)'
const RESOLVED_STROKE = 'rgba(78,201,176,0.45)'

// Accept button dimensions
const BTN_W = 32
const BTN_H = 18
const BTN_MARGIN_TOP = 4

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
        return chunks.flatMap((chunk, i) => {
            const range = displayRanges[i]
            if (!range) return []

            const top = getTop(range.start) - scrollTop
            const bottom = getTop(range.end + 1) - scrollTop
            const bandH = Math.max(bottom - top, 2)

            // Skip chunks entirely outside the visible viewport
            if (bottom < -20 || top > height + 20) return []

            const isResolved = chunk.resolvedWith !== undefined
            const isConflict = chunk.type === 'conflict' && !isResolved

            const fill = isResolved
                ? RESOLVED_FILL
                : isConflict
                  ? CONFLICT_FILL
                  : NONCONFLICT_FILL
            const stroke = isResolved
                ? RESOLVED_STROKE
                : isConflict
                  ? CONFLICT_STROKE
                  : NONCONFLICT_STROKE

            // Button positioning: right-aligned in left gutter, left-aligned in right gutter
            const btnX = side === 'left' ? width - BTN_W - 2 : 2
            const btnY = top + BTN_MARGIN_TOP
            const btnLabel = side === 'left' ? '<<' : '>>'
            const onAccept = () =>
                side === 'left' ? onAcceptOurs?.(i) : onAcceptTheirs?.(i)

            const result = [
                // Connector band (full-width colored strip)
                <rect
                    key={`band-${i}`}
                    x={0}
                    y={top}
                    width={width}
                    height={bandH}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1}
                />,
            ]

            if (isConflict) {
                result.push(
                    // Button background
                    <rect
                        key={`btn-bg-${i}`}
                        x={btnX}
                        y={btnY}
                        width={BTN_W}
                        height={BTN_H}
                        rx={3}
                        fill={side === 'left' ? 'rgba(188,63,60,0.6)' : 'rgba(60,100,188,0.6)'}
                        stroke={side === 'left' ? 'rgba(220,80,70,0.9)' : 'rgba(70,120,220,0.9)'}
                        strokeWidth={1}
                        style={{ cursor: 'pointer' }}
                        onClick={onAccept}
                    />,
                    // Button label
                    <text
                        key={`btn-lbl-${i}`}
                        x={btnX + BTN_W / 2}
                        y={btnY + BTN_H * 0.68}
                        textAnchor="middle"
                        fontSize={10}
                        fontFamily="'SF Mono', 'Fira Code', Consolas, monospace"
                        fontWeight="bold"
                        fill="rgba(255,255,255,0.95)"
                        style={{ cursor: 'pointer', userSelect: 'none', pointerEvents: 'none' }}
                    >
                        {btnLabel}
                    </text>
                )
            }

            return result
        })
    }, [chunks, displayRanges, getTop, width, height, scrollTop, side, onAcceptOurs, onAcceptTheirs])

    return (
        <svg
            width={width}
            height={height}
            style={{ display: 'block', width: '100%', height: '100%' }}
            aria-hidden
        >
            {elements}
        </svg>
    )
}
