import { beforeEach, describe, expect, it, vi } from 'vitest'

type Listener<T> = (v: T) => void | Promise<void>

interface MockPanel {
    active: boolean
    reveal: ReturnType<typeof vi.fn>
    dispose: ReturnType<typeof vi.fn>
    webview: {
        html: string
        postMessage: ReturnType<typeof vi.fn>
        asWebviewUri: (u: unknown) => unknown
        cspSource: string
        onDidReceiveMessage: (cb: Listener<unknown>) => { dispose: () => void }
    }
    onDidDispose: (cb: () => void) => { dispose: () => void }
    onDidChangeViewState: (cb: () => void) => { dispose: () => void }
    fireDispose: () => void
    fireViewStateChange: () => void
    receiveMessage: (msg: unknown) => Promise<void>
}

// vi.mock is hoisted; vi.hoisted lets shared state coexist by being hoisted with it.
const mocks = vi.hoisted(() => {
    const createdPanels: MockPanel[] = []
    const showWarningMessage = vi.fn()
    const showErrorMessage = vi.fn()
    const showInformationMessage = vi.fn()
    const writeFile = vi.fn().mockResolvedValue(undefined)

    function makePanel(): MockPanel {
        const disposeListeners: Array<() => void> = []
        const viewStateListeners: Array<() => void> = []
        let messageListener: Listener<unknown> | undefined

        const panel: MockPanel = {
            active: true,
            reveal: vi.fn(),
            dispose: vi.fn(),
            webview: {
                html: '',
                postMessage: vi.fn(),
                asWebviewUri: (u: unknown) => u,
                cspSource: 'vscode-webview:',
                onDidReceiveMessage: (cb: Listener<unknown>) => {
                    messageListener = cb
                    return { dispose: vi.fn() }
                },
            },
            onDidDispose: (cb: () => void) => {
                disposeListeners.push(cb)
                return { dispose: vi.fn() }
            },
            onDidChangeViewState: (cb: () => void) => {
                viewStateListeners.push(cb)
                return { dispose: vi.fn() }
            },
            fireDispose: () => {
                disposeListeners.forEach((l) => l())
            },
            fireViewStateChange: () => {
                viewStateListeners.forEach((l) => l())
            },
            receiveMessage: async (msg: unknown) => {
                if (messageListener) await messageListener(msg)
            },
        }
        return panel
    }

    const createWebviewPanel = vi.fn(() => {
        const p = makePanel()
        createdPanels.push(p)
        return p
    })

    return {
        createdPanels,
        showWarningMessage,
        showErrorMessage,
        showInformationMessage,
        writeFile,
        createWebviewPanel,
    }
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
        createWebviewPanel: mocks.createWebviewPanel,
        showWarningMessage: mocks.showWarningMessage,
        showErrorMessage: mocks.showErrorMessage,
        showInformationMessage: mocks.showInformationMessage,
    },
    workspace: {
        fs: { writeFile: mocks.writeFile },
        asRelativePath: (uri: { fsPath: string }) => uri.fsPath,
    },
    Uri: {
        joinPath: (base: unknown) => base,
    },
    ViewColumn: { One: 1 },
}))

vi.mock('fs', () => ({
    readdirSync: () => [] as string[],
}))

const {
    createdPanels,
    showWarningMessage,
    showErrorMessage,
    showInformationMessage,
    writeFile,
} = mocks

import * as vscode from 'vscode'
import { MergeEditorProvider } from '../../src/providers/MergeEditorProvider'

function makeUri(path: string) {
    return {
        fsPath: path,
        toString: () => `file://${path}`,
    } as unknown as vscode.Uri
}

function makeGit() {
    return {
        isRebasing: vi.fn(() => false),
        getFileContents: vi.fn().mockResolvedValue(''),
        stageFile: vi.fn().mockResolvedValue(undefined),
    }
}

function makeSession() {
    return {
        setChunkDecision: vi.fn(),
        setChunkManual: vi.fn(),
        autoResolveNonConflicting: vi.fn(),
        magicResolve: vi.fn(),
        magicResolveChunk: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        getChunks: vi.fn(() => []),
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
    }
}

beforeEach(() => {
    createdPanels.length = 0
    showWarningMessage.mockReset()
    showErrorMessage.mockReset()
    showInformationMessage.mockReset()
    writeFile.mockReset().mockResolvedValue(undefined)
})

describe('MergeEditorProvider — active-editor tracking', () => {
    it('fires onDidChangeActiveEditor with the URI when an editor is opened', () => {
        const git = makeGit()
        const session = makeSession()
        const provider = new MergeEditorProvider(
            makeUri('/ext'),
            git as never,
            session as never
        )

        const events: Array<string | undefined> = []
        provider.onDidChangeActiveEditor((u) => events.push(u))

        const uri = makeUri('/repo/a.ts')
        provider.openEditor(uri)

        expect(events).toEqual(['file:///repo/a.ts'])
    })

    it('fires undefined when the active panel is disposed', () => {
        const provider = new MergeEditorProvider(
            makeUri('/ext'),
            makeGit() as never,
            makeSession() as never
        )
        const events: Array<string | undefined> = []
        provider.onDidChangeActiveEditor((u) => events.push(u))

        const uri = makeUri('/repo/a.ts')
        provider.openEditor(uri)
        createdPanels[0].fireDispose()

        expect(events).toEqual(['file:///repo/a.ts', undefined])
    })

    it('clears active when the panel loses focus and re-sets it on regain', () => {
        const provider = new MergeEditorProvider(
            makeUri('/ext'),
            makeGit() as never,
            makeSession() as never
        )
        const events: Array<string | undefined> = []
        provider.onDidChangeActiveEditor((u) => events.push(u))

        provider.openEditor(makeUri('/repo/a.ts'))
        const panel = createdPanels[0]

        panel.active = false
        panel.fireViewStateChange()
        panel.active = true
        panel.fireViewStateChange()

        expect(events).toEqual([
            'file:///repo/a.ts',
            undefined,
            'file:///repo/a.ts',
        ])
    })
})

describe('MergeEditorProvider — unsaved-changes warning on close', () => {
    it('does not warn when the panel was never modified', async () => {
        const provider = new MergeEditorProvider(
            makeUri('/ext'),
            makeGit() as never,
            makeSession() as never
        )
        provider.openEditor(makeUri('/repo/a.ts'))
        createdPanels[0].fireDispose()
        await Promise.resolve()

        expect(showWarningMessage).not.toHaveBeenCalled()
    })

    it('warns when a dirty panel is closed', async () => {
        showWarningMessage.mockResolvedValue(undefined)
        const provider = new MergeEditorProvider(
            makeUri('/ext'),
            makeGit() as never,
            makeSession() as never
        )
        const uri = makeUri('/repo/a.ts')
        provider.openEditor(uri)
        const panel = createdPanels[0]

        await panel.receiveMessage({
            type: 'chunkDecision',
            chunkIndex: 0,
            side: 'ours',
            decision: 'accept',
        })
        panel.fireDispose()
        await Promise.resolve()

        expect(showWarningMessage).toHaveBeenCalledTimes(1)
        const [message] = showWarningMessage.mock.calls[0]
        expect(String(message)).toMatch(/unsaved changes/i)
    })

    it('does not warn if the dirty panel was saved before close', async () => {
        const git = makeGit()
        const provider = new MergeEditorProvider(
            makeUri('/ext'),
            git as never,
            makeSession() as never
        )
        const uri = makeUri('/repo/a.ts')
        provider.openEditor(uri)
        const panel = createdPanels[0]

        await panel.receiveMessage({
            type: 'chunkDecision',
            chunkIndex: 0,
            side: 'ours',
            decision: 'accept',
        })
        await panel.receiveMessage({
            type: 'saveFile',
            content: 'clean file\n',
        })
        showWarningMessage.mockClear()
        panel.fireDispose()
        await Promise.resolve()

        expect(showWarningMessage).not.toHaveBeenCalled()
    })
})

describe('MergeEditorProvider — saveFile staging + conflict warning', () => {
    it('stages the file via git.stageFile after a clean save', async () => {
        const git = makeGit()
        const provider = new MergeEditorProvider(
            makeUri('/ext'),
            git as never,
            makeSession() as never
        )
        const uri = makeUri('/repo/a.ts')
        provider.openEditor(uri)
        const panel = createdPanels[0]

        await panel.receiveMessage({
            type: 'saveFile',
            content: 'no markers here\n',
        })

        expect(writeFile).toHaveBeenCalledTimes(1)
        expect(git.stageFile).toHaveBeenCalledTimes(1)
        expect(git.stageFile).toHaveBeenCalledWith(uri)
        expect(showInformationMessage).toHaveBeenCalled()
    })

    it('shows a modal warning when content still contains conflict markers and aborts on cancel', async () => {
        showWarningMessage.mockResolvedValue(undefined) // user cancels
        const git = makeGit()
        const provider = new MergeEditorProvider(
            makeUri('/ext'),
            git as never,
            makeSession() as never
        )
        const uri = makeUri('/repo/a.ts')
        provider.openEditor(uri)
        const panel = createdPanels[0]

        const dirty = [
            'top',
            '<<<<<<< HEAD',
            'ours',
            '=======',
            'theirs',
            '>>>>>>> branch',
            '<<<<<<< HEAD',
            'ours2',
            '=======',
            'theirs2',
            '>>>>>>> branch',
        ].join('\n')
        await panel.receiveMessage({ type: 'saveFile', content: dirty })

        expect(showWarningMessage).toHaveBeenCalledTimes(1)
        const [message, options] = showWarningMessage.mock.calls[0]
        expect(String(message)).toMatch(/2 unresolved conflicts/)
        expect(options).toMatchObject({ modal: true })

        // Aborted: no write, no stage.
        expect(writeFile).not.toHaveBeenCalled()
        expect(git.stageFile).not.toHaveBeenCalled()
    })

    it('writes but does not stage when the user picks "Save Anyway" with markers present', async () => {
        showWarningMessage.mockResolvedValue('Save Anyway')
        const git = makeGit()
        const provider = new MergeEditorProvider(
            makeUri('/ext'),
            git as never,
            makeSession() as never
        )
        const uri = makeUri('/repo/a.ts')
        provider.openEditor(uri)
        const panel = createdPanels[0]

        const dirty = [
            '<<<<<<< HEAD',
            'ours',
            '=======',
            'theirs',
            '>>>>>>> branch',
        ].join('\n')
        await panel.receiveMessage({ type: 'saveFile', content: dirty })

        expect(writeFile).toHaveBeenCalledTimes(1)
        expect(git.stageFile).not.toHaveBeenCalled()
    })

    it('surfaces a warning when staging fails but keeps the save', async () => {
        const git = makeGit()
        git.stageFile.mockRejectedValueOnce(new Error('locked'))
        const provider = new MergeEditorProvider(
            makeUri('/ext'),
            git as never,
            makeSession() as never
        )
        const uri = makeUri('/repo/a.ts')
        provider.openEditor(uri)
        const panel = createdPanels[0]

        await panel.receiveMessage({
            type: 'saveFile',
            content: 'clean\n',
        })

        expect(writeFile).toHaveBeenCalledTimes(1)
        expect(git.stageFile).toHaveBeenCalledTimes(1)
        expect(showWarningMessage).toHaveBeenCalled()
        const [message] = showWarningMessage.mock.calls[0]
        expect(String(message)).toMatch(/failed to stage/i)
    })
})
