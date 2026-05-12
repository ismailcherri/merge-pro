import * as monaco from 'monaco-editor'
import { useEffect, useMemo, useRef } from 'react'
import { isChunkResolved, type ConflictChunk } from '../../src/protocol'
import { magicMerge } from '../../src/utils/magicMerge'
import type { ChunkLineMap } from './buildDisplayDocuments'
import { ChunkBandLayer } from './ChunkBandLayer'

interface Props {
    chunks: ConflictChunk[]
    chunkMaps: ChunkLineMap[]
    /** Result editor — the column lives in the result strip. */
    editor: monaco.editor.IStandaloneCodeEditor | null
    width: number
    height: number
    onMagicChunk: (chunkIndex: number) => void
}

const WAND_H = 16
const WAND_TOP_PAD = 2

export function MagicWandColumn({
    chunks,
    chunkMaps,
    editor,
    width,
    height,
    onMagicChunk,
}: Props) {
    const groupRefs = useRef<(SVGGElement | null)[]>([])
    const rafRef = useRef<number | null>(null)

    // The wand is reserved for true conflicts that magicMerge can still
    // resolve safely. Non-conflicting chunks are handled by Auto-Resolve and
    // shouldn't compete for the same visual affordance.
    const mergeable = useMemo(() => {
        const out = new Set<number>()
        chunks.forEach((c, i) => {
            if (c.type !== 'conflict') return
            if (isChunkResolved(c)) return
            if (magicMerge(c.baseLines, c.oursLines, c.theirsLines) !== null) {
                out.add(i)
            }
        })
        return out
    }, [chunks])

    useEffect(() => {
        if (!editor) return

        const update = () => {
            rafRef.current = null
            const scroll = editor.getScrollTop()

            for (let i = 0; i < chunks.length; i++) {
                const map = chunkMaps[i]
                const grp = groupRefs.current[i]
                if (!map || !grp) continue

                const range = map.result
                const top = editor.getTopForLineNumber(range.start) - scroll
                const bot =
                    editor.getTopForLineNumber(range.end + 1) - scroll
                const onScreen = bot >= 0 && top <= height
                if (!onScreen) {
                    grp.style.display = 'none'
                    continue
                }
                grp.style.display = ''
                const y = Math.min(
                    top + WAND_TOP_PAD,
                    Math.max(top, bot - WAND_H)
                )
                const x = (width - WAND_H) / 2
                grp.setAttribute('transform', `translate(${x}, ${y})`)
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
    }, [chunks, chunkMaps, editor, height, width])

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <ChunkBandLayer
                chunks={chunks}
                chunkMaps={chunkMaps}
                editor={editor}
                pane="result"
                width={width}
                height={height}
            />
            <svg
                width={width}
                height={height}
                style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                }}
            >
                {chunks.map((_, i) => {
                if (!mergeable.has(i)) return null
                return (
                    <g
                        key={`wand-${i}`}
                        ref={(el) => {
                            groupRefs.current[i] = el
                        }}
                        style={{ display: 'none', cursor: 'pointer' }}
                        onClick={() => onMagicChunk(i)}
                    >
                        <title>Magic-merge this chunk</title>
                        <rect
                            width={WAND_H}
                            height={WAND_H}
                            rx={3}
                            fill="transparent"
                        />
                        <text
                            x={WAND_H / 2}
                            y={WAND_H * 0.78}
                            textAnchor="middle"
                            fontSize={12}
                            style={{
                                userSelect: 'none',
                                pointerEvents: 'none',
                            }}
                        >
                            ✨
                        </text>
                    </g>
                )
            })}
            </svg>
        </div>
    )
}
