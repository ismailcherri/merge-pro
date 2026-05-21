import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConflictChunk } from '../../../src/protocol'
import type { ChunkLineMap } from '../../../webview/editor/buildDisplayDocuments'
import { MagicWandColumn } from '../../../webview/editor/MagicWandColumn'

const trivialMap: ChunkLineMap = {
    ours: { start: 1, end: 2 },
    result: { start: 1, end: 2 },
    theirs: { start: 1, end: 2 },
}

function mergeableChunk(): ConflictChunk {
    // True conflict, but ours and theirs edit different lines in the chunk →
    // magicMerge resolves to ['X', 'Y'].
    return {
        type: 'conflict',
        baseLines: ['b', 'c'],
        oursLines: ['X', 'c'],
        theirsLines: ['b', 'Y'],
        baseStartLine: 0,
        baseEndLine: 2,
    }
}

function autoResolvableChunk(): ConflictChunk {
    // Non-conflicting (only ours changed). Magic should NOT show a wand —
    // Auto-Resolve owns this category.
    return {
        type: 'non-conflicting',
        baseLines: ['b'],
        oursLines: ['X'],
        theirsLines: ['b'],
        baseStartLine: 0,
        baseEndLine: 1,
        winner: 'ours',
    }
}

function unmergeableChunk(): ConflictChunk {
    // Both sides edited the same line differently — magicMerge returns null.
    return {
        type: 'conflict',
        oursLines: ['X'],
        baseLines: ['b'],
        theirsLines: ['Y'],
        baseStartLine: 0,
        baseEndLine: 1,
    }
}

describe('MagicWandColumn', () => {
    it('renders a wand only for conflicts magicMerge can resolve', () => {
        const second = {
            ...mergeableChunk(),
            baseStartLine: 10,
            baseEndLine: 12,
        }
        const chunks = [mergeableChunk(), unmergeableChunk(), second]
        const chunkMaps = [trivialMap, trivialMap, trivialMap]
        const { container } = render(
            <MagicWandColumn
                chunks={chunks}
                chunkMaps={chunkMaps}
                editor={null}
                width={22}
                height={300}
                onMagicChunk={() => {}}
            />
        )
        // One <g> per mergeable conflict (2 of 3).
        const wandGroups = container.querySelectorAll('svg > g')
        expect(wandGroups.length).toBe(2)
    })

    it('does not render a wand for non-conflicting (Auto-Resolve) chunks', () => {
        // Even though magicMerge would technically return a value here, the
        // wand is reserved for true conflicts. These belong to Auto-Resolve.
        const chunks = [autoResolvableChunk(), autoResolvableChunk()]
        const { container } = render(
            <MagicWandColumn
                chunks={chunks}
                chunkMaps={[trivialMap, trivialMap]}
                editor={null}
                width={22}
                height={300}
                onMagicChunk={() => {}}
            />
        )
        expect(container.querySelectorAll('svg > g').length).toBe(0)
    })

    it('skips already-resolved chunks even if they would be mergeable', () => {
        const resolved: ConflictChunk = {
            ...mergeableChunk(),
            manualLines: ['anything'],
        }
        const { container } = render(
            <MagicWandColumn
                chunks={[resolved]}
                chunkMaps={[trivialMap]}
                editor={null}
                width={22}
                height={300}
                onMagicChunk={() => {}}
            />
        )
        expect(container.querySelectorAll('svg > g').length).toBe(0)
    })

    it('fires onMagicChunk with the chunk index when clicked', () => {
        const onMagicChunk = vi.fn()
        const chunks = [unmergeableChunk(), mergeableChunk()]
        const { container } = render(
            <MagicWandColumn
                chunks={chunks}
                chunkMaps={[trivialMap, trivialMap]}
                editor={null}
                width={22}
                height={300}
                onMagicChunk={onMagicChunk}
            />
        )
        const wand = container.querySelector('svg > g')
        expect(wand).not.toBeNull()
        fireEvent.click(wand!)
        // Index 1 is the mergeable chunk; index 0 is unmergeable (no wand).
        expect(onMagicChunk).toHaveBeenCalledWith(1)
    })
})
