import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener<T> = (v: T) => void

interface MockWebview {
    options: unknown
    html: string
    cspSource: string
    postMessage: ReturnType<typeof vi.fn>
    asWebviewUri: (u: unknown) => unknown
    onDidReceiveMessage: (cb: Listener<unknown>) => { dispose: () => void }
    receiveMessage: (msg: unknown) => void
}

interface MockView {
    webview: MockWebview
}

function makeWebview(): MockWebview {
    let listener: Listener<unknown> | undefined
    return {
        options: {},
        html: '',
        cspSource: 'vscode-webview:',
        postMessage: vi.fn(),
        asWebviewUri: (u: unknown) => u,
        onDidReceiveMessage: (cb: Listener<unknown>) => {
            listener = cb
            return { dispose: vi.fn() }
        },
        receiveMessage: (msg: unknown) => listener?.(msg),
    }
}

function makeView(): MockView {
    return { webview: makeWebview() }
}

const mocks = vi.hoisted(() => ({
    executeCommand: vi.fn(),
}))

vi.mock('vscode', () => ({
    EventEmitter: class<T> {
        private cbs: Array<Listener<T>> = []
        event = (cb: Listener<T>) => {
            this.cbs.push(cb)
            return { dispose: () => {} }
        }
        fire = (v: T) => {
            this.cbs.forEach((cb) => cb(v))
        }
        dispose = vi.fn()
    },
    Uri: { joinPath: (base: unknown) => base },
    commands: { executeCommand: mocks.executeCommand },
}))

import * as vscode from 'vscode'
import { MergePanelProvider } from '../../src/providers/MergePanelProvider'

function makeSession() {
    const cbs: Array<Listener<unknown>> = []
    return {
        onDidSessionUpdate: (cb: Listener<unknown>) => {
            cbs.push(cb)
            return { dispose: vi.fn() }
        },
        fireUpdate: (v: unknown) => cbs.forEach((cb) => cb(v)),
        getSessionState: vi.fn(() => ({
            files: [
                {
                    uri: {
                        toString: () => 'file:///repo/a.ts',
                    } as never,
                    fileName: 'a.ts',
                    totalChunks: 3,
                    resolvedChunks: 1,
                    chunks: [],
                },
            ],
        })),
    }
}

beforeEach(() => {
    mocks.executeCommand.mockReset()
})

describe('MergePanelProvider', () => {
    it('exposes a stable viewId', () => {
        expect(MergePanelProvider.viewId).toBe('mergePro.panel')
    })

    it('on resolve, sets webview options + HTML and immediately posts session state', () => {
        const session = makeSession()
        const provider = new MergePanelProvider(
            { fsPath: '/ext' } as never as vscode.Uri,
            session as never
        )
        const view = makeView()
        provider.resolveWebviewView(view as never)

        expect(view.webview.html).toContain('<!DOCTYPE html>')
        expect(view.webview.postMessage).toHaveBeenCalledTimes(1)
        const [msg] = view.webview.postMessage.mock.calls[0]
        expect(msg).toMatchObject({
            type: 'stateUpdate',
            state: {
                activeEditorUri: undefined,
                files: [
                    {
                        uri: 'file:///repo/a.ts',
                        fileName: 'a.ts',
                        totalChunks: 3,
                        resolvedChunks: 1,
                    },
                ],
            },
        })
    })

    it('forwards webview-to-host messages via vscode.commands.executeCommand', () => {
        const session = makeSession()
        const provider = new MergePanelProvider(
            { fsPath: '/ext' } as never as vscode.Uri,
            session as never
        )
        const view = makeView()
        provider.resolveWebviewView(view as never)

        view.webview.receiveMessage({
            type: 'openEditor',
            uri: 'file:///repo/a.ts',
        })

        expect(mocks.executeCommand).toHaveBeenCalledWith(
            'mergePro._panelMessage',
            { type: 'openEditor', uri: 'file:///repo/a.ts' }
        )
    })

    it('re-posts state when the session fires onDidSessionUpdate', () => {
        const session = makeSession()
        const provider = new MergePanelProvider(
            { fsPath: '/ext' } as never as vscode.Uri,
            session as never
        )
        const view = makeView()
        provider.resolveWebviewView(view as never)
        view.webview.postMessage.mockClear()

        session.fireUpdate({ files: [] })

        expect(view.webview.postMessage).toHaveBeenCalledTimes(1)
        const [msg] = view.webview.postMessage.mock.calls[0]
        expect(msg).toMatchObject({ type: 'stateUpdate' })
    })

    it('setActiveEditorUri posts the activeEditorUri to the webview', () => {
        const session = makeSession()
        const provider = new MergePanelProvider(
            { fsPath: '/ext' } as never as vscode.Uri,
            session as never
        )
        const view = makeView()
        provider.resolveWebviewView(view as never)
        view.webview.postMessage.mockClear()

        provider.setActiveEditorUri('file:///repo/a.ts')

        const [msg] = view.webview.postMessage.mock.calls[0]
        expect(msg).toMatchObject({
            type: 'stateUpdate',
            state: { activeEditorUri: 'file:///repo/a.ts' },
        })
    })

    it('setActiveEditorUri is a no-op when no view is resolved', () => {
        const session = makeSession()
        const provider = new MergePanelProvider(
            { fsPath: '/ext' } as never as vscode.Uri,
            session as never
        )
        // Should not throw.
        expect(() => provider.setActiveEditorUri('x')).not.toThrow()
    })

    it('dispose disposes registered disposables', () => {
        const session = makeSession()
        const provider = new MergePanelProvider(
            { fsPath: '/ext' } as never as vscode.Uri,
            session as never
        )
        const view = makeView()
        provider.resolveWebviewView(view as never)
        expect(() => provider.dispose()).not.toThrow()
    })
})
