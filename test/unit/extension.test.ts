import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener<T> = (v: T) => void

const mocks = vi.hoisted(() => ({
    registerWebviewViewProvider: vi.fn(() => ({ dispose: vi.fn() })),
    registeredCommands: new Map<string, (...args: unknown[]) => unknown>(),
    registerCommand: vi.fn(),
    executeCommand: vi.fn(),
    activeTextEditor: undefined as { document: { uri: unknown } } | undefined,
}))

mocks.registerCommand.mockImplementation((id: string, cb: () => unknown) => {
    mocks.registeredCommands.set(id, cb as never)
    return { dispose: vi.fn() }
})

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
    window: {
        registerWebviewViewProvider: mocks.registerWebviewViewProvider,
        get activeTextEditor() {
            return mocks.activeTextEditor
        },
        showWarningMessage: vi.fn(),
        showErrorMessage: vi.fn(),
        showInformationMessage: vi.fn(),
        createWebviewPanel: vi.fn(),
    },
    workspace: {
        asRelativePath: (u: { fsPath: string }) => u.fsPath,
        onDidChangeTextDocument: () => ({ dispose: vi.fn() }),
        fs: { writeFile: vi.fn(), readFile: vi.fn() },
    },
    commands: {
        registerCommand: mocks.registerCommand,
        executeCommand: mocks.executeCommand,
    },
    extensions: {
        getExtension: vi.fn(() => undefined),
        onDidChange: () => ({ dispose: vi.fn() }),
    },
    Uri: {
        parse: (s: string) => ({ fsPath: s, toString: () => s }),
        joinPath: (base: unknown) => base,
    },
    ViewColumn: { One: 1 },
}))

vi.mock('fs', () => ({ existsSync: () => false, readdirSync: () => [] }))

import * as vscode from 'vscode'
import { activate, deactivate } from '../../src/extension'

function makeContext(): vscode.ExtensionContext {
    return {
        subscriptions: [],
        extensionUri: { fsPath: '/ext' },
    } as never as vscode.ExtensionContext
}

beforeEach(() => {
    mocks.registerWebviewViewProvider.mockClear()
    mocks.registerCommand.mockClear()
    mocks.executeCommand.mockClear()
    mocks.registeredCommands.clear()
    mocks.activeTextEditor = undefined
})

describe('extension.activate', () => {
    it('registers the merge panel view provider', () => {
        const ctx = makeContext()
        activate(ctx)
        expect(mocks.registerWebviewViewProvider).toHaveBeenCalledWith(
            'mergePro.panel',
            expect.anything()
        )
    })

    it('registers all expected commands', () => {
        const ctx = makeContext()
        activate(ctx)
        const ids = Array.from(mocks.registeredCommands.keys())
        expect(ids).toEqual(
            expect.arrayContaining([
                'mergePro._panelMessage',
                'mergePro.openEditor',
                'mergePro.prevConflict',
                'mergePro.nextConflict',
            ])
        )
    })

    it('pushes disposables onto context.subscriptions', () => {
        const ctx = makeContext()
        activate(ctx)
        expect(ctx.subscriptions.length).toBeGreaterThan(0)
    })

    it('mergePro.openEditor is a no-op when there is no active editor', () => {
        const ctx = makeContext()
        activate(ctx)
        const handler = mocks.registeredCommands.get('mergePro.openEditor')!
        expect(() => handler()).not.toThrow()
    })

    it('mergePro.prevConflict / nextConflict delegate to _navigate', () => {
        const ctx = makeContext()
        activate(ctx)
        mocks.registeredCommands.get('mergePro.prevConflict')!()
        mocks.registeredCommands.get('mergePro.nextConflict')!()
        expect(mocks.executeCommand).toHaveBeenCalledWith(
            'mergePro._navigate',
            -1
        )
        expect(mocks.executeCommand).toHaveBeenCalledWith(
            'mergePro._navigate',
            1
        )
    })

    it('mergePro._panelMessage with batchAccept and autoResolve does not throw', () => {
        const ctx = makeContext()
        activate(ctx)
        const handler = mocks.registeredCommands.get('mergePro._panelMessage')!
        expect(() =>
            handler({
                type: 'batchAccept',
                uri: 'file:///repo/a.ts',
                side: 'ours',
            })
        ).not.toThrow()
        expect(() =>
            handler({ type: 'autoResolve', uri: 'file:///repo/a.ts' })
        ).not.toThrow()
    })
})

describe('extension.deactivate', () => {
    it('runs without throwing', () => {
        expect(() => deactivate()).not.toThrow()
    })
})
