import type { ChunkLineMap, LineRange } from './buildDisplayDocuments'

export type Pane = 'ours' | 'result' | 'theirs'

function rangeFor(map: ChunkLineMap, pane: Pane): LineRange {
    return map[pane]
}

/**
 * Map a 1-indexed line in `srcPane` to the corresponding 1-indexed line in
 * `dstPane`. Unchanged regions between chunks advance 1:1; lines inside a
 * chunk map proportionally to preserve fractional position within the
 * chunk's range.
 *
 * `chunkMaps` is expected to be in traversal (sorted) order.
 */
export function mapLine(
    srcPane: Pane,
    dstPane: Pane,
    line: number,
    chunkMaps: ChunkLineMap[]
): number {
    if (srcPane === dstPane) return line

    let srcCursor = 1
    let dstCursor = 1

    for (const map of chunkMaps) {
        const src = rangeFor(map, srcPane)
        const dst = rangeFor(map, dstPane)

        if (line < src.start) {
            return dstCursor + (line - srcCursor)
        }

        if (line <= src.end) {
            const srcLen = Math.max(src.end - src.start + 1, 1)
            const dstLen = Math.max(dst.end - dst.start + 1, 0)
            if (dstLen === 0) return dst.start
            const frac = (line - src.start) / srcLen
            return dst.start + Math.min(dstLen - 1, Math.floor(frac * dstLen))
        }

        srcCursor = src.end + 1
        dstCursor = dst.end + 1
    }

    return dstCursor + (line - srcCursor)
}
