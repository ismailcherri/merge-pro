import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConflictChunk } from '../../../src/protocol'
import type { ChunkLineMap } from '../../../webview/editor/buildDisplayDocuments'
import { DecisionButtons } from '../../../webview/editor/DecisionButtons'

function makeFakeEditor(scrollTop = 0) {
    return {
        getScrollTop: () => scrollTop,
        // Map line N → (N-1)*20 in editor coords.
        getTopForLineNumber: (ln: number) => (ln - 1) * 20,
        onDidScrollChange: () => ({ dispose: vi.fn() }),
        onDidContentSizeChange: () => ({ dispose: vi.fn() }),
        onDidLayoutChange: () => ({ dispose: vi.fn() }),
    }
}

function chunk(): ConflictChunk {
    return {
        type: 'conflict',
        oursLines: ['x'],
        baseLines: ['a'],
        theirsLines: ['y'],
        baseStartLine: 0,
        baseEndLine: 1,
    }
}

const visibleMap: ChunkLineMap = {
    ours: { start: 1, end: 2 },
    result: { start: 1, end: 2 },
    theirs: { start: 1, end: 2 },
}

beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', ((cb: FrameRequestCallback) => {
        cb(0)
        return 1
    }) as typeof requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('DecisionButtons — with editor', () => {
    it('shows the band + buttons when the chunk is on screen', () => {
        const { container } = render(
            <DecisionButtons
                chunks={[chunk()]}
                chunkMaps={[visibleMap]}
                editor={makeFakeEditor(0) as never}
                side="ours"
                pane="ours"
                width={42}
                height={300}
            />
        )
        // Band rect is the first rect; with onScreen=true it has display=''.
        const rects = Array.from(
            container.querySelectorAll('rect')
        ) as SVGRectElement[]
        const band = rects[0]
        expect(band.style.display).toBe('')
        // y attribute should reflect the top of the visible chunk.
        expect(band.getAttribute('y')).toBeTruthy()
    })

    it('hides the band when the chunk has scrolled off the bottom', () => {
        // Tiny viewport, no scroll, chunk well below height → off-screen top.
        const offScreenMap: ChunkLineMap = {
            ours: { start: 100, end: 101 },
            result: { start: 100, end: 101 },
            theirs: { start: 100, end: 101 },
        }
        const { container } = render(
            <DecisionButtons
                chunks={[chunk()]}
                chunkMaps={[offScreenMap]}
                editor={makeFakeEditor(0) as never}
                side="ours"
                pane="ours"
                width={42}
                height={50}
            />
        )
        const band = container.querySelector('rect') as SVGRectElement
        expect(band.style.display).toBe('none')
    })
})
