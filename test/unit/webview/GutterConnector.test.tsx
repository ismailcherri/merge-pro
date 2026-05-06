import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ConflictChunk } from '../../../src/protocol'
import { GutterConnector } from '../../../webview/editor/GutterConnector'

function makeChunk(
    baseStartLine: number,
    baseEndLine: number,
    type: 'conflict' | 'non-conflicting' = 'conflict'
): ConflictChunk {
    return {
        type,
        oursLines: [],
        baseLines: [],
        theirsLines: [],
        baseStartLine,
        baseEndLine,
    }
}

const mockGetTop = (line: number) => (line - 1) * 26

describe('GutterConnector', () => {
    it('renders split triangles for conflict chunks', () => {
        const chunks = [makeChunk(0, 2, 'conflict')]
        const { container } = render(
            <GutterConnector
                chunks={chunks}
                leftGetTop={mockGetTop}
                rightGetTop={mockGetTop}
                height={300}
                width={52}
                scrollTop={0}
            />
        )
        const group = container.querySelector('g')
        expect(group).not.toBeNull()
        expect(group!.querySelectorAll('polygon').length).toBe(2)
    })

    it('renders single polygon for non-conflicting chunks', () => {
        const chunks = [makeChunk(0, 1, 'non-conflicting')]
        const { container } = render(
            <GutterConnector
                chunks={chunks}
                leftGetTop={mockGetTop}
                rightGetTop={mockGetTop}
                height={300}
                width={52}
                scrollTop={0}
            />
        )
        const polygons = container.querySelectorAll('polygon')
        expect(polygons.length).toBe(1)
    })

    it('fires onAcceptOurs when left triangle clicked', () => {
        const onAcceptOurs = vi.fn()
        const chunks = [makeChunk(0, 2, 'conflict')]
        const { container } = render(
            <GutterConnector
                chunks={chunks}
                leftGetTop={mockGetTop}
                rightGetTop={mockGetTop}
                height={300}
                width={52}
                scrollTop={0}
                onAcceptOurs={onAcceptOurs}
            />
        )
        const group = container.querySelector('g')!
        const leftTriangle = group.querySelectorAll('polygon')[0]
        fireEvent.click(leftTriangle)
        expect(onAcceptOurs).toHaveBeenCalledWith(0)
    })

    it('fires onAcceptTheirs when right triangle clicked', () => {
        const onAcceptTheirs = vi.fn()
        const chunks = [makeChunk(0, 2, 'conflict')]
        const { container } = render(
            <GutterConnector
                chunks={chunks}
                leftGetTop={mockGetTop}
                rightGetTop={mockGetTop}
                height={300}
                width={52}
                scrollTop={0}
                onAcceptTheirs={onAcceptTheirs}
            />
        )
        const group = container.querySelector('g')!
        const rightTriangle = group.querySelectorAll('polygon')[1]
        fireEvent.click(rightTriangle)
        expect(onAcceptTheirs).toHaveBeenCalledWith(0)
    })
})
