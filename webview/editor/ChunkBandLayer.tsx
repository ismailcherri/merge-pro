import * as monaco from 'monaco-editor'
import { useEffect, useMemo, useRef } from 'react'
import { isChunkResolved, type ConflictChunk } from '../../src/protocol'
import type { ChunkLineMap } from './buildDisplayDocuments'
import { CHUNK_FILL } from './chunkColors'
import type { Pane } from './lineMapping'

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
}: Readonly<Props>) {
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
                if (resolved) fill = CHUNK_FILL.resolved
                else if (anyDecision) fill = CHUNK_FILL.partial
                else if (c.type === 'conflict') fill = CHUNK_FILL.conflict
                else fill = CHUNK_FILL.nonConflicting
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
                    style={{ display: 'none', fill: v.fill }}
                />
            ))}
        </svg>
    )
}
