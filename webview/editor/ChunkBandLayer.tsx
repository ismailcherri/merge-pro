import * as monaco from 'monaco-editor'
import { useEffect, useMemo, useRef } from 'react'
import { isChunkResolved, type ConflictChunk } from '../../src/protocol'
import type { ChunkLineMap } from './buildDisplayDocuments'
import type { Pane } from './lineMapping'

// Mirror DecisionButtons / GutterConnector palette so the band visually
// continues edge-to-edge across every intermediate column.
const FILL_CONFLICT = 'rgba(188,63,60,0.22)'
const FILL_NONCONFLICT = 'rgba(98,178,98,0.18)'
const FILL_RESOLVED = 'rgba(78,201,176,0.18)'
const FILL_PARTIAL = 'rgba(188,63,60,0.12)'
const MIN_TIP_HEIGHT = 2

interface Props {
    chunks: ConflictChunk[]
    chunkMaps: ChunkLineMap[]
    editor: monaco.editor.IStandaloneCodeEditor | null
    /** Which pane's line range drives Y placement. */
    pane: Pane
    width: number
    height: number
}

interface ChunkVisual {
    chunkIndex: number
    fill: string
}

/**
 * Absolutely-positioned SVG layer painting chunk-color bands aligned to a
 * Monaco editor's line ranges. Use as a background underlay in narrow
 * intermediate columns (line-number strips, magic-wand column) so the line
 * band visually continues across the full editor row.
 */
export function ChunkBandLayer({
    chunks,
    chunkMaps,
    editor,
    pane,
    width,
    height,
}: Props) {
    const bandRefs = useRef<(SVGRectElement | null)[]>([])
    const rafRef = useRef<number | null>(null)

    const visuals: ChunkVisual[] = useMemo(
        () =>
            chunks.map((c, i) => {
                const resolved = isChunkResolved(c)
                const anyDecision =
                    c.oursDecision !== undefined ||
                    c.theirsDecision !== undefined
                let fill: string
                if (resolved) fill = FILL_RESOLVED
                else if (anyDecision) fill = FILL_PARTIAL
                else if (c.type === 'conflict') fill = FILL_CONFLICT
                else fill = FILL_NONCONFLICT
                return { chunkIndex: i, fill }
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
                const band = bandRefs.current[i]
                if (!map || !band) continue

                const range = map[pane]
                let top = editor.getTopForLineNumber(range.start) - scroll
                let bot = editor.getTopForLineNumber(range.end + 1) - scroll
                if (bot - top < MIN_TIP_HEIGHT) {
                    const half = MIN_TIP_HEIGHT / 2
                    top -= half
                    bot += half
                }

                const onScreen = bot >= 0 && top <= height
                if (!onScreen) {
                    band.style.display = 'none'
                    continue
                }
                band.style.display = ''
                band.setAttribute('y', String(top))
                band.setAttribute('height', String(Math.max(0, bot - top)))
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

    return (
        <svg
            width={width}
            height={height}
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
            }}
        >
            {visuals.map((v) => (
                <rect
                    key={`band-${v.chunkIndex}`}
                    ref={(el) => {
                        bandRefs.current[v.chunkIndex] = el
                    }}
                    x={0}
                    y={0}
                    width={width}
                    height={0}
                    fill={v.fill}
                    style={{ display: 'none' }}
                />
            ))}
        </svg>
    )
}
