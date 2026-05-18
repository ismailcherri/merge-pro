import { describe, expect, it, vi } from 'vitest'

type Listener<T> = (v: T) => void

const mocks = vi.hoisted(() => {
    const repoAdd = vi.fn().mockResolvedValue(undefined)
    const repositories: Array<{
        rootUri: { fsPath: string; toString: () => string }
        state: {
            mergeChanges: unknown[]
            onDidChange: (cb: Listener<void>) => { dispose: () => void }
        }
        add: typeof repoAdd
    }> = []

    function makeRepo(rootFsPath: string) {
        return {
            rootUri: { fsPath: rootFsPath, toString: () => rootFsPath },
            state: {
                mergeChanges: [],
                onDidChange: (_cb: Listener<void>) => ({ dispose: () => {} }),
            },
            add: repoAdd,
        }
    }

    const gitApi = {
        repositories,
        onDidOpenRepository: (_cb: Listener<unknown>) => ({
            dispose: () => {},
        }),
    }

    const showWarningMessage = vi.fn()

    return { repoAdd, repositories, gitApi, makeRepo, showWarningMessage }
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
    window: { showWarningMessage: mocks.showWarningMessage },
    workspace: {
        asRelativePath: (uri: { fsPath: string }) => uri.fsPath,
        fs: { readFile: vi.fn() },
    },
    Uri: {},
    extensions: {
        getExtension: vi.fn(() => ({
            isActive: true,
            exports: { getAPI: (_v: number) => mocks.gitApi },
            activate: () => Promise.resolve({ getAPI: () => mocks.gitApi }),
        })),
        onDidChange: (_cb: Listener<void>) => ({ dispose: () => {} }),
    },
}))

vi.mock('fs', () => ({ existsSync: () => false }))

import { GitService } from '../../src/services/GitService'

describe('GitService.stageFile', () => {
    it('calls repo.add with the URI of the matching repository', async () => {
        mocks.repositories.length = 0
        mocks.repositories.push(mocks.makeRepo('/repo'))
        mocks.repoAdd.mockClear()

        const git = new GitService()
        // GitService.init() activates the git extension synchronously in our
        // mock; wait a microtask so the .then() resolves.
        await Promise.resolve()

        const uri = {
            fsPath: '/repo/src/a.ts',
            toString: () => 'file:///repo/src/a.ts',
        } as never
        await git.stageFile(uri)

        expect(mocks.repoAdd).toHaveBeenCalledTimes(1)
        expect(mocks.repoAdd).toHaveBeenCalledWith([uri])
    })

    it('falls back to the first repo when no repo path-matches the URI', async () => {
        mocks.repositories.length = 0
        mocks.repositories.push(mocks.makeRepo('/other-repo'))
        mocks.repoAdd.mockClear()

        const git = new GitService()
        await Promise.resolve()

        const uri = {
            fsPath: '/unrelated/path/a.ts',
            toString: () => 'file:///unrelated/path/a.ts',
        } as never
        await git.stageFile(uri)

        expect(mocks.repoAdd).toHaveBeenCalledTimes(1)
    })

    it('is a no-op when there are no repositories', async () => {
        mocks.repositories.length = 0
        mocks.repoAdd.mockClear()

        const git = new GitService()
        await Promise.resolve()

        const uri = {
            fsPath: '/repo/a.ts',
            toString: () => 'file:///repo/a.ts',
        } as never
        await expect(git.stageFile(uri)).resolves.toBeUndefined()
        expect(mocks.repoAdd).not.toHaveBeenCalled()
    })
})
