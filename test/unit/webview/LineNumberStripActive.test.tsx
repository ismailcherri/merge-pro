import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('monaco-editor', () => ({
    editor: { EditorOption: { lineHeight: 0 } },
}))

import { LineNumberStrip } from '../../../webview/editor/LineNumberStrip'

function makeFakeEditor(opts: {
    lineCount: number
    lineHeight?: number
    scrollTop?: number
}) {
    const lineHeight = opts.lineHeight ?? 18
    const scrollTop = opts.scrollTop ?? 0
    return {
        getOption: () => lineHeight,
        getScrollTop: () => scrollTop,
        getTopForLineNumber: (ln: number) => (ln - 1) * lineHeight,
        getModel: () => ({ getLineCount: () => opts.lineCount }),
        onDidScrollChange: () => ({ dispose: vi.fn() }),
        onDidContentSizeChange: () => ({ dispose: vi.fn() }),
        onDidLayoutChange: () => ({ dispose: vi.fn() }),
        onDidChangeModel: () => ({ dispose: vi.fn() }),
        onDidChangeModelContent: () => ({ dispose: vi.fn() }),
    }
}

beforeEach(() => {
    // Drive requestAnimationFrame synchronously so the scheduled onFrame
    // runs inside the render pass and we can observe the line-number items.
    vi.stubGlobal('requestAnimationFrame', ((cb: FrameRequestCallback) => {
        cb(0)
        return 1
    }) as typeof requestAnimationFrame)
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('LineNumberStrip — with editor', () => {
    it('renders line-number items for the visible window after raf fires', () => {
        const editor = makeFakeEditor({ lineCount: 10 })
        const { container } = render(
            <LineNumberStrip
                editor={editor as never}
                width={36}
                height={90}
                align="right"
            />
        )
        // Visible window: lineHeight 18, height 90 → ~5 lines, plus overscan.
        const root = container.firstChild as HTMLDivElement
        // The first child is the items wrapper; check that at least one line
        // number text was rendered.
        const texts = Array.from(root.querySelectorAll('div')).map(
            (d) => d.textContent
        )
        expect(texts.some((t) => t === '1')).toBe(true)
    })

    it('aligns to the left when align="left" and right when align="right"', () => {
        const editor = makeFakeEditor({ lineCount: 3 })
        const { container, rerender } = render(
            <LineNumberStrip
                editor={editor as never}
                width={36}
                height={60}
                align="right"
            />
        )
        const firstNumber = (container.firstChild as HTMLElement).querySelector(
            'div'
        ) as HTMLDivElement
        expect(firstNumber.style.textAlign).toBe('right')

        rerender(
            <LineNumberStrip
                editor={editor as never}
                width={36}
                height={60}
                align="left"
            />
        )
        const afterRerender = (
            container.firstChild as HTMLElement
        ).querySelector('div') as HTMLDivElement
        expect(afterRerender.style.textAlign).toBe('left')
    })

    it('cleans up listeners on unmount without throwing', () => {
        const editor = makeFakeEditor({ lineCount: 5 })
        const { unmount } = render(
            <LineNumberStrip
                editor={editor as never}
                width={36}
                height={60}
                align="right"
            />
        )
        expect(() => act(() => unmount())).not.toThrow()
    })
})
