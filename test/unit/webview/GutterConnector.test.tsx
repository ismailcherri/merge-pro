import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConflictChunk } from '../../../src/protocol'
import type { ChunkLineMap } from '../../../webview/editor/buildDisplayDocuments'
import { DecisionButtons } from '../../../webview/editor/DecisionButtons'
import { GutterConnector } from '../../../webview/editor/GutterConnector'

function makeChunk(
    type: 'conflict' | 'non-conflicting' = 'conflict'
): ConflictChunk {
    return {
        type,
        // Both sides differ from base → both sides changed → buttons render
        // on each side (matches `singleChangedSide(chunk) === null`).
        oursLines: ['x'],
        baseLines: ['a'],
        theirsLines: ['y'],
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
    it('renders one connector path per chunk', () => {
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
                width={32}
                height={300}
            />
        )
        const paths = container.querySelectorAll('path')
        expect(paths.length).toBe(2)
    })
})

describe('DecisionButtons', () => {
    it('renders accept+discard buttons for every unresolved chunk', () => {
        const chunks = [makeChunk('conflict'), makeChunk('non-conflicting')]
        const chunkMaps = [trivialMap, trivialMap]
        const { container } = render(
            <DecisionButtons
                chunks={chunks}
                chunkMaps={chunkMaps}
                editor={null}
                side="ours"
                pane="ours"
                width={42}
                height={300}
            />
        )
        // Each chunk renders: 1 band rect + 2 button rects → 6 rects total.
        const rects = container.querySelectorAll('rect')
        expect(rects.length).toBe(6)
    })

    it('fires onDecision with accept when the accept button is clicked', () => {
        const onDecision = vi.fn()
        const chunks = [makeChunk('conflict')]
        const { container } = render(
            <DecisionButtons
                chunks={chunks}
                chunkMaps={[trivialMap]}
                editor={null}
                side="ours"
                pane="ours"
                width={42}
                height={300}
                onDecision={onDecision}
            />
        )
        // For ours: layout is [×][»] → discardIdx=0, acceptIdx=1, but DOM
        // order in the JSX is accept first, then discard.
        const buttonGroups = container.querySelectorAll('g > g > g')
        fireEvent.click(buttonGroups[0])
        expect(onDecision).toHaveBeenCalledWith(0, 'ours', 'accept')
    })

    it('fires onDecision with discard when the discard button is clicked', () => {
        const onDecision = vi.fn()
        const chunks = [makeChunk('conflict')]
        const { container } = render(
            <DecisionButtons
                chunks={chunks}
                chunkMaps={[trivialMap]}
                editor={null}
                side="theirs"
                pane="theirs"
                width={42}
                height={300}
                onDecision={onDecision}
            />
        )
        const buttonGroups = container.querySelectorAll('g > g > g')
        fireEvent.click(buttonGroups[1])
        expect(onDecision).toHaveBeenCalledWith(0, 'theirs', 'discard')
    })

    it('does not render buttons for a one-sided change on the unchanged side', () => {
        // Only theirs changed → ours column should render no buttons.
        const chunk: ConflictChunk = {
            type: 'non-conflicting',
            oursLines: ['a'],
            baseLines: ['a'],
            theirsLines: ['z'],
            baseStartLine: 0,
            baseEndLine: 1,
        }
        const { container } = render(
            <DecisionButtons
                chunks={[chunk]}
                chunkMaps={[trivialMap]}
                editor={null}
                side="ours"
                pane="ours"
                width={42}
                height={300}
            />
        )
        // Band rect renders, but no button rects.
        const rects = container.querySelectorAll('rect')
        expect(rects.length).toBe(1)
    })
})
