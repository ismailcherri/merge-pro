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
    it('renders accept+discard buttons for every unresolved chunk', () => {
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
        // Two buttons (accept + discard) per unresolved chunk → 4 total.
        const buttons = container.querySelectorAll('g > g > g > rect')
        expect(buttons.length).toBe(4)
    })

    it('fires onDecision with accept when accept button clicked', () => {
        const onDecision = vi.fn()
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
                onDecision={onDecision}
            />
        )
        // DOM order in render: accept first, then discard.
        const buttons = container.querySelectorAll('g > g > g')
        fireEvent.click(buttons[0])
        expect(onDecision).toHaveBeenCalledWith(0, 'ours', 'accept')
    })

    it('fires onDecision with discard when discard button clicked', () => {
        const onDecision = vi.fn()
        const chunks = [makeChunk('conflict')]
        const { container } = render(
            <GutterConnector
                chunks={chunks}
                chunkMaps={[trivialMap]}
                leftEditor={null}
                rightEditor={null}
                leftPane="result"
                rightPane="theirs"
                width={48}
                height={300}
                side="right"
                onDecision={onDecision}
            />
        )
        const buttons = container.querySelectorAll('g > g > g')
        fireEvent.click(buttons[1])
        expect(onDecision).toHaveBeenCalledWith(0, 'theirs', 'discard')
    })
})
