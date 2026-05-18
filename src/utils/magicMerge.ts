/**
 * "Magic" three-way merge for a single conflict region. Returns the merged
 * line array on success, or `null` if the two sides made changes that cannot
 * be combined safely.
 *
 * Strategy: compute the LCS-based edit hunks for base→ours and base→theirs.
 * If the hunks touch disjoint base ranges (or are byte-identical), they can
 * be woven together. Otherwise the change is a real conflict — return null.
 *
 * Pure-insertion conflicts at the same base position are treated as real
 * conflicts (the order is ambiguous), matching IntelliJ's conservative wand.
 */

interface Hunk {
    /** Inclusive start in `base`. */
    baseStart: number
    /** Exclusive end in `base`. `baseEnd === baseStart` means pure insertion. */
    baseEnd: number
    /** Replacement lines. Empty means pure deletion. */
    newLines: string[]
}

function linesEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Compute LCS-based edit hunks describing how `b` differs from `a`. Each hunk
 * means "replace a[baseStart..baseEnd) with newLines". Adjacent edits are
 * coalesced into one hunk; matching runs between edits are not emitted.
 */
function diffHunks(a: string[], b: string[]): Hunk[] {
    const m = a.length
    const n = b.length
    // LCS length table.
    const c: number[][] = Array.from({ length: m + 1 }, () =>
        new Array<number>(n + 1).fill(0)
    )
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) c[i][j] = c[i - 1][j - 1] + 1
            else
                c[i][j] = c[i - 1][j] >= c[i][j - 1] ? c[i - 1][j] : c[i][j - 1]
        }
    }
    // Backtrack to recover matched index pairs.
    const matches: Array<[number, number]> = []
    let i = m
    let j = n
    while (i > 0 && j > 0) {
        if (a[i - 1] === b[j - 1]) {
            matches.push([i - 1, j - 1])
            i--
            j--
        } else if (c[i - 1][j] >= c[i][j - 1]) {
            i--
        } else {
            j--
        }
    }
    matches.reverse()

    // Build hunks for the gaps between matches.
    const hunks: Hunk[] = []
    let ai = 0
    let bi = 0
    for (const [ma, mb] of matches) {
        if (ma > ai || mb > bi) {
            hunks.push({
                baseStart: ai,
                baseEnd: ma,
                newLines: b.slice(bi, mb),
            })
        }
        ai = ma + 1
        bi = mb + 1
    }
    if (ai < m || bi < n) {
        hunks.push({ baseStart: ai, baseEnd: m, newLines: b.slice(bi) })
    }
    return hunks
}

interface TaggedHunk extends Hunk {
    src: 'ours' | 'theirs'
}

/**
 * Detects whether two hunks should be considered conflicting after the
 * identical-hunk dedup pass. Hunks touching overlapping base ranges always
 * conflict; two pure insertions at the same base position also conflict
 * because their relative ordering is ambiguous.
 */
function hunksConflict(a: TaggedHunk, b: TaggedHunk): boolean {
    // Range overlap (excludes the touching-edge case `a.baseEnd === b.baseStart`).
    if (a.baseEnd > b.baseStart && b.baseEnd > a.baseStart) return true
    // Pure insertions at the same anchor: ambiguous ordering.
    if (
        a.baseStart === b.baseStart &&
        a.baseStart === a.baseEnd &&
        b.baseStart === b.baseEnd
    ) {
        return true
    }
    return false
}

export function magicMerge(
    base: string[],
    ours: string[],
    theirs: string[]
): string[] | null {
    if (linesEqual(ours, theirs)) return ours.slice()
    if (linesEqual(ours, base)) return theirs.slice()
    if (linesEqual(theirs, base)) return ours.slice()

    const oursHunks: TaggedHunk[] = diffHunks(base, ours).map((h) => ({
        ...h,
        src: 'ours',
    }))
    const theirsHunks: TaggedHunk[] = diffHunks(base, theirs).map((h) => ({
        ...h,
        src: 'theirs',
    }))

    // Stable sort by base position; among hunks at the same start, prefer the
    // one that ends earlier so overlap-detection compares neighbors directly.
    const all = [...oursHunks, ...theirsHunks].sort((x, y) => {
        if (x.baseStart !== y.baseStart) return x.baseStart - y.baseStart
        return x.baseEnd - y.baseEnd
    })

    // Walk pairs; merge identical hunks; reject true overlaps.
    const merged: TaggedHunk[] = []
    for (const h of all) {
        const last = merged[merged.length - 1]
        if (last) {
            // Identical hunk from both sides → take once.
            if (
                last.baseStart === h.baseStart &&
                last.baseEnd === h.baseEnd &&
                linesEqual(last.newLines, h.newLines)
            ) {
                continue
            }
            if (hunksConflict(last, h)) return null
        }
        merged.push(h)
    }

    // Apply merged hunks to base.
    const result: string[] = []
    let cursor = 0
    for (const h of merged) {
        for (let k = cursor; k < h.baseStart; k++) result.push(base[k])
        result.push(...h.newLines)
        cursor = h.baseEnd
    }
    for (let k = cursor; k < base.length; k++) result.push(base[k])
    return result
}
