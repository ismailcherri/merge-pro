import { describe, expect, it } from 'vitest'
import {
    fillForVisual,
    hideBand,
    hideButtons,
    showBand,
    showButtons,
    type ChunkVisual,
} from '../../../webview/editor/DecisionButtons'

function makeVisual(overrides: Partial<ChunkVisual> = {}): ChunkVisual {
    return {
        chunkIndex: 0,
        isConflict: false,
        isResolved: false,
        isPartial: false,
        ...overrides,
    }
}

describe('fillForVisual', () => {
    it('returns the resolved fill when isResolved is set', () => {
        expect(fillForVisual(makeVisual({ isResolved: true }))).toMatch(
            /78,201,176/
        )
    })

    it('returns the partial fill when isPartial is set and not resolved', () => {
        expect(fillForVisual(makeVisual({ isPartial: true }))).toMatch(
            /188,63,60.*0\.12/
        )
    })

    it('returns the conflict fill when isConflict is set', () => {
        expect(fillForVisual(makeVisual({ isConflict: true }))).toMatch(
            /188,63,60.*0\.22/
        )
    })

    it('returns the non-conflicting fill by default', () => {
        expect(fillForVisual(makeVisual())).toMatch(/98,178,98/)
    })
})

function makeRect(): SVGRectElement {
    return document.createElementNS(
        'http://www.w3.org/2000/svg',
        'rect'
    ) as SVGRectElement
}

function makeGroup(): SVGGElement {
    return document.createElementNS(
        'http://www.w3.org/2000/svg',
        'g'
    ) as SVGGElement
}

describe('showBand / hideBand', () => {
    it('showBand clears display, sets y and a non-negative height attribute', () => {
        const band = makeRect()
        band.style.display = 'none'
        showBand(band, 12, 30)
        expect(band.style.display).toBe('')
        expect(band.getAttribute('y')).toBe('12')
        expect(band.getAttribute('height')).toBe('18')
    })

    it('showBand clamps a negative height to 0 when bot < top', () => {
        const band = makeRect()
        showBand(band, 50, 40)
        expect(band.getAttribute('height')).toBe('0')
    })

    it('hideBand sets display to none', () => {
        const band = makeRect()
        hideBand(band)
        expect(band.style.display).toBe('none')
    })
})

describe('showButtons / hideButtons', () => {
    it('showButtons clears display and writes a translate transform', () => {
        const grp = makeGroup()
        grp.style.display = 'none'
        showButtons(grp, 20, 80, 42)
        expect(grp.style.display).toBe('')
        const transform = grp.getAttribute('transform') ?? ''
        expect(transform).toMatch(/^translate\(/)
    })

    it('hideButtons sets display to none', () => {
        const grp = makeGroup()
        hideButtons(grp)
        expect(grp.style.display).toBe('none')
    })

    it('showButtons clamps the y position when the chunk is shorter than the buttons', () => {
        const grp = makeGroup()
        // bot - top is below BTN_H (16), so btnY should clamp to `top`.
        showButtons(grp, 100, 105, 42)
        const transform = grp.getAttribute('transform') ?? ''
        const match =
            /translate\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/.exec(
                transform
            )
        expect(match).not.toBeNull()
        const y = Number(match![2])
        expect(y).toBeGreaterThanOrEqual(100)
    })
})
