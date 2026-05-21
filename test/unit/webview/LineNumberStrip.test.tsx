import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LineNumberStrip } from '../../../webview/editor/LineNumberStrip'

// The interesting code paths inside LineNumberStrip require a live Monaco
// editor (scroll listeners, line-top measurements). We can at least cover the
// null-editor early-return path: it renders an empty container so layout
// reserves the right width.
describe('LineNumberStrip — no editor', () => {
    it('renders an empty placeholder div with the requested width and height', () => {
        const { container } = render(
            <LineNumberStrip
                editor={null}
                width={36}
                height={300}
                align="right"
            />
        )
        const root = container.firstChild as HTMLDivElement
        expect(root).toBeTruthy()
        expect(root.style.width).toBe('36px')
        expect(root.style.height).toBe('300px')
        expect(root.children.length).toBe(0)
    })
})
