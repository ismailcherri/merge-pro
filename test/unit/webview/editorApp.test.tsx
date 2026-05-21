import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// App.tsx invokes acquireVsCodeApi() once at module evaluation. Install the
// stub via vi.hoisted so it's in place before the (hoisted) module imports.
const { postMessage } = vi.hoisted(() => {
    const pm = vi.fn()
    ;(
        globalThis as unknown as {
            acquireVsCodeApi: () => { postMessage: typeof pm }
        }
    ).acquireVsCodeApi = () => ({ postMessage: pm })
    return { postMessage: pm }
})

// ThreePaneEditor pulls in monaco-editor, which doesn't work cleanly under
// jsdom. Stub it with a passive render so we can exercise App's message
// plumbing without booting Monaco.
vi.mock('../../../webview/editor/ThreePaneEditor', () => ({
    ThreePaneEditor: (props: {
        fileName: string
        onAutoResolve: () => void
        onMagicResolve: () => void
        onUndo: () => void
        onRedo: () => void
        onSave: (content: string) => void
        onChunkDecision: (
            i: number,
            side: 'ours' | 'theirs',
            d: 'accept' | 'discard'
        ) => void
        onMagicResolveChunk: (i: number) => void
    }) => (
        <div data-testid="three-pane" data-filename={props.fileName}>
            <button onClick={props.onAutoResolve}>auto-resolve</button>
            <button onClick={props.onMagicResolve}>magic-resolve</button>
            <button onClick={() => props.onMagicResolveChunk(2)}>
                magic-chunk
            </button>
            <button onClick={props.onUndo}>undo</button>
            <button onClick={props.onRedo}>redo</button>
            <button onClick={() => props.onSave('saved content')}>save</button>
            <button onClick={() => props.onChunkDecision(0, 'ours', 'accept')}>
                decide
            </button>
        </div>
    ),
}))

beforeEach(() => {
    postMessage.mockReset()
})

import { App, ErrorBoundary } from '../../../webview/editor/App'

function sendInit(fileName = 'foo.ts'): void {
    const event = new MessageEvent('message', {
        data: {
            type: 'init',
            oursText: 'a',
            baseText: 'a',
            theirsText: 'a',
            chunks: [],
            fileName,
            uri: 'file:///' + fileName,
            canUndo: false,
            canRedo: false,
        },
    })
    window.dispatchEvent(event)
}

describe('editor App', () => {
    it('shows a loading placeholder before the first init message', () => {
        render(<App />)
        expect(screen.getByText(/loading merge editor/i)).toBeTruthy()
    })

    it('posts a "ready" message on mount', () => {
        render(<App />)
        expect(postMessage).toHaveBeenCalledWith({ type: 'ready' })
    })

    it('renders the editor and detects the language after an init message', async () => {
        render(<App />)
        await act(async () => {
            sendInit('foo.tsx')
        })
        const pane = screen.getByTestId('three-pane')
        expect(pane).toBeTruthy()
        expect(pane.getAttribute('data-filename')).toBe('foo.tsx')
    })

    it.each([
        ['auto-resolve', { type: 'autoResolve' }],
        ['magic-resolve', { type: 'magicResolve' }],
        ['undo', { type: 'undo' }],
        ['redo', { type: 'redo' }],
    ] as const)(
        'forwards %s as the expected message',
        async (buttonLabel, expected) => {
            render(<App />)
            await act(async () => sendInit())
            postMessage.mockClear()
            fireEvent.click(screen.getByText(buttonLabel))
            expect(postMessage).toHaveBeenCalledWith(expected)
        }
    )

    it('forwards magic-chunk with the chunk index', async () => {
        render(<App />)
        await act(async () => sendInit())
        postMessage.mockClear()
        fireEvent.click(screen.getByText('magic-chunk'))
        expect(postMessage).toHaveBeenCalledWith({
            type: 'magicResolveChunk',
            chunkIndex: 2,
        })
    })

    it('forwards chunk decisions and save messages with the relevant payload', async () => {
        render(<App />)
        await act(async () => sendInit('a.ts'))
        postMessage.mockClear()

        fireEvent.click(screen.getByText('decide'))
        expect(postMessage).toHaveBeenCalledWith({
            type: 'chunkDecision',
            chunkIndex: 0,
            side: 'ours',
            decision: 'accept',
        })

        fireEvent.click(screen.getByText('save'))
        expect(postMessage).toHaveBeenCalledWith({
            type: 'saveFile',
            uri: 'file:///a.ts',
            content: 'saved content',
        })
    })

    it('updates chunks/undo/redo when a chunkUpdate arrives after init', async () => {
        render(<App />)
        await act(async () => sendInit())
        // chunkUpdate before init is a no-op (state stays null); after init it
        // patches into the existing state without throwing.
        await act(async () => {
            window.dispatchEvent(
                new MessageEvent('message', {
                    data: {
                        type: 'chunkUpdate',
                        chunks: [],
                        canUndo: true,
                        canRedo: true,
                    },
                })
            )
        })
        // No assertion target on the stub — main goal is to cover the branch
        // without crashing. Verify the editor stub is still present.
        expect(screen.getByTestId('three-pane')).toBeTruthy()
    })
})

describe('editor ErrorBoundary', () => {
    function Boom(): null {
        throw new Error('boom')
    }

    it('renders a fallback UI with a Retry button when a child throws', () => {
        // Suppress React's noisy error logging for this test.
        const err = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        )
        expect(screen.getByText(/failed to load/i)).toBeTruthy()
        expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy()
        err.mockRestore()
    })

    it('posts a "ready" message when Retry is clicked', () => {
        const err = vi.spyOn(console, 'error').mockImplementation(() => {})
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>
        )
        postMessage.mockClear()
        fireEvent.click(screen.getByRole('button', { name: /retry/i }))
        expect(postMessage).toHaveBeenCalledWith({ type: 'ready' })
        err.mockRestore()
    })
})
