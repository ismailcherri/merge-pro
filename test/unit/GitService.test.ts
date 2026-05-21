import { describe, expect, it, vi } from 'vitest'

type Listener<T> = (v: T) => void

const mocks = vi.hoisted(() => {
    const repoAdd = vi.fn().mockResolvedValue(undefined)
    const execFileMock =
        vi.fn<
            (cmd: string, args: string[], opts: { cwd?: string }) => unknown
        >()
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

    return {
        repoAdd,
        repositories,
        gitApi,
        makeRepo,
        showWarningMessage,
        execFileMock,
    }
})

vi.mock('child_process', () => ({
    execFile: (
        cmd: string,
        args: string[],
        opts: { cwd?: string },
        cb: (err: Error | null, out: { stdout: string; stderr: string }) => void
    ) => {
        mocks.execFileMock(cmd, args, opts)
        cb(null, { stdout: '', stderr: '' })
    },
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
    window: { showWarningMessage: mocks.showWarningMessage },
    workspace: {
        asRelativePath: (uri: { fsPath: string }) => uri.fsPath,
        fs: { readFile: vi.fn() },
    },
    Uri: {
        file: (p: string) => ({ fsPath: p, toString: () => `file://${p}` }),
    },
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
    it('shells out to `git add` from the matching repository root', async () => {
        mocks.repositories.length = 0
        mocks.repositories.push(mocks.makeRepo('/repo'))
        mocks.execFileMock.mockClear()

        const git = new GitService()
        // GitService.init() activates the git extension synchronously in our
        // mock; wait a microtask so the .then() resolves.
        await Promise.resolve()

        const uri = {
            fsPath: '/repo/src/a.ts',
            path: '/repo/src/a.ts',
            scheme: 'file',
            toString: () => 'file:///repo/src/a.ts',
        } as never
        await git.stageFile(uri)

        expect(mocks.execFileMock).toHaveBeenCalledTimes(1)
        expect(mocks.execFileMock).toHaveBeenCalledWith(
            'git',
            ['add', '--', '/repo/src/a.ts'],
            { cwd: '/repo' }
        )
    })

    it('falls back to the first repo when no repo path-matches the URI', async () => {
        mocks.repositories.length = 0
        mocks.repositories.push(mocks.makeRepo('/other-repo'))
        mocks.execFileMock.mockClear()

        const git = new GitService()
        await Promise.resolve()

        const uri = {
            fsPath: '/unrelated/path/a.ts',
            path: '/unrelated/path/a.ts',
            scheme: 'file',
            toString: () => 'file:///unrelated/path/a.ts',
        } as never
        await git.stageFile(uri)

        expect(mocks.execFileMock).toHaveBeenCalledWith(
            'git',
            ['add', '--', '/unrelated/path/a.ts'],
            { cwd: '/other-repo' }
        )
    })

    it('normalizes a malformed URI whose fsPath leaks the file: scheme', async () => {
        mocks.repositories.length = 0
        mocks.repositories.push(mocks.makeRepo('/repo'))
        mocks.execFileMock.mockClear()

        const git = new GitService()
        await Promise.resolve()

        // Simulate the bug: a Uri whose fsPath kept the "file:" prefix as a
        // literal because the original string was parsed without a recognized
        // scheme. Without normalization, this gets passed to `git add` as a
        // relative path and git rejects it as "outside repository".
        const uri = {
            fsPath: 'file:/repo/src/a.ts',
            path: 'file:/repo/src/a.ts',
            scheme: '',
            toString: () => 'file:/repo/src/a.ts',
        } as never
        await git.stageFile(uri)

        expect(mocks.execFileMock).toHaveBeenCalledWith(
            'git',
            ['add', '--', '/repo/src/a.ts'],
            { cwd: '/repo' }
        )
    })

    it('is a no-op when there are no repositories', async () => {
        mocks.repositories.length = 0
        mocks.execFileMock.mockClear()

        const git = new GitService()
        await Promise.resolve()

        const uri = {
            fsPath: '/repo/a.ts',
            path: '/repo/a.ts',
            scheme: 'file',
            toString: () => 'file:///repo/a.ts',
        } as never
        await expect(git.stageFile(uri)).resolves.toBeUndefined()
        expect(mocks.execFileMock).not.toHaveBeenCalled()
    })
})
