import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConflictChunk } from '../../../src/protocol'
import type { ChunkLineMap } from '../../../webview/editor/buildDisplayDocuments'
import { GutterConnector } from '../../../webview/editor/GutterConnector'

function makeChunk(
    type: 'conflict' | 'non-conflicting' = 'conflict'
): ConflictChunk {
    return {
        type,
        oursLines: ['a'],
        baseLines: ['a'],
        theirsLines: ['a'],
        baseStartLine: 0,
        baseEndLine: 1,
    }
}

const trivialMap: ChunkLineMap = {
    ours: { start: 1, end: 2 },
    result: { start: 1, end: 2 },
    theirs: { start: 1, end: 2 },
}

describe('GutterConnector', () => {
    it('renders one path per chunk plus accept button for conflicts', () => {
        const chunks = [makeChunk('conflict'), makeChunk('non-conflicting')]
        const chunkMaps = [trivialMap, trivialMap]
        const { container } = render(
            <GutterConnector
                chunks={chunks}
                chunkMaps={chunkMaps}
                leftEditor={null}
                rightEditor={null}
                leftPane="ours"
                rightPane="result"
                width={48}
                height={300}
                side="left"
            />
        )
        const paths = container.querySelectorAll('path')
        expect(paths.length).toBe(2)
        // Only the conflict chunk renders an accept button (a <g> with rect+text).
        const buttons = container.querySelectorAll('g > g > rect')
        expect(buttons.length).toBe(1)
    })

    it('fires onAccept with chunk index when button clicked', () => {
        const onAccept = vi.fn()
        const chunks = [makeChunk('conflict')]
        const { container } = render(
            <GutterConnector
                chunks={chunks}
                chunkMaps={[trivialMap]}
                leftEditor={null}
                rightEditor={null}
                leftPane="ours"
                rightPane="result"
                width={48}
                height={300}
                side="left"
                onAccept={onAccept}
            />
        )
        const buttonGroup = container.querySelector('g > g')!
        fireEvent.click(buttonGroup)
        expect(onAccept).toHaveBeenCalledWith(0)
    })
})
