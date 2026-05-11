import { describe, expect, it, vi } from 'vitest'

// Mock vscode before importing anything that uses it
vi.mock('vscode', () => ({
    EventEmitter: class {
        _cb: unknown
        event = (cb: unknown) => {
            this._cb = cb
        }
        fire = (v: unknown) => {
            if (this._cb) (this._cb as (v: unknown) => void)(v)
        }
        dispose = vi.fn()
    },
    workspace: {
        fs: { readFile: vi.fn().mockResolvedValue(new Uint8Array()) },
        asRelativePath: (uri: { fsPath: string }) => uri.fsPath,
        onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
    },
    Uri: { file: (p: string) => ({ fsPath: p, toString: () => p }) },
}))

import { MergeSessionManager } from '../../src/services/MergeSessionManager'

function makeGitService(changes: Array<{ fsPath: string }> = []) {
    const emitter = { fire: vi.fn(), event: vi.fn(), dispose: vi.fn() }
    return {
        onDidMergeStateChange: emitter.event,
        getMergeChanges: vi.fn(() =>
            changes.map((c) => ({
                uri: { fsPath: c.fsPath, toString: () => c.fsPath },
                fileName: c.fsPath,
            }))
        ),
        getFileContents: vi.fn().mockResolvedValue(''),
        isRebasing: vi.fn(() => false),
        _emitter: emitter,
    }
}

describe('MergeSessionManager', () => {
    it('starts with an empty session', () => {
        const git = makeGitService()
        const mgr = new MergeSessionManager(git as never)
        expect(mgr.getSessionState().files).toHaveLength(0)
    })

    it('emits onDidSessionUpdate when refreshAll is called', async () => {
        const git = makeGitService([{ fsPath: '/repo/foo.ts' }])
        const mgr = new MergeSessionManager(git as never)
        const spy = vi.fn()
        mgr.onDidSessionUpdate(spy)

        await mgr.refreshAll()

        expect(spy).toHaveBeenCalled()
    })

    it('tracks totalChunks per file after refresh', async () => {
        const git = makeGitService([{ fsPath: '/repo/foo.ts' }])
        // getFileContents: stage 2 (ours), stage 1 (base), stage 3 (theirs)
        git.getFileContents
            .mockResolvedValueOnce('a\nb\nc') // ours (stage 2)
            .mockResolvedValueOnce('a\nb\nc') // base (stage 1)
            .mockResolvedValueOnce('a\nX\nc') // theirs (stage 3) — 1 non-conflicting chunk

        const mgr = new MergeSessionManager(git as never)
        await mgr.refreshAll()

        const state = mgr.getSessionState()
        expect(state.files).toHaveLength(1)
        expect(state.files[0].totalChunks).toBe(1)
        expect(state.files[0].resolvedChunks).toBe(0)
    })

    it('setChunkDecision marks a chunk as resolved once both sides decided', async () => {
        const git = makeGitService([{ fsPath: '/repo/foo.ts' }])
        git.getFileContents
            .mockResolvedValueOnce('a\nb\nc')
            .mockResolvedValueOnce('a\nb\nc')
            .mockResolvedValueOnce('a\nX\nc')

        const mgr = new MergeSessionManager(git as never)
        await mgr.refreshAll()

        const uri = {
            fsPath: '/repo/foo.ts',
            toString: () => '/repo/foo.ts',
        } as never
        mgr.setChunkDecision(uri, 0, 'ours', 'accept')
        // One side decided is not yet resolved.
        expect(mgr.getSessionState().files[0].resolvedChunks).toBe(0)
        mgr.setChunkDecision(uri, 0, 'theirs', 'discard')
        expect(mgr.getSessionState().files[0].resolvedChunks).toBe(1)
    })

    describe('undo / redo', () => {
        const uri = {
            fsPath: '/repo/foo.ts',
            toString: () => '/repo/foo.ts',
        } as never

        async function setupConflict() {
            const git = makeGitService([{ fsPath: '/repo/foo.ts' }])
            // Both sides change line 2 from base → 1 conflict chunk.
            git.getFileContents
                .mockResolvedValueOnce('a\nX\nc')
                .mockResolvedValueOnce('a\nb\nc')
                .mockResolvedValueOnce('a\nY\nc')
            const mgr = new MergeSessionManager(git as never)
            await mgr.refreshAll()
            return { mgr, git }
        }

        it('canUndo/canRedo are false on a freshly-loaded file', async () => {
            const { mgr } = await setupConflict()
            expect(mgr.canUndo(uri)).toBe(false)
            expect(mgr.canRedo(uri)).toBe(false)
        })

        it('undo reverts a setChunkDecision', async () => {
            const { mgr } = await setupConflict()
            mgr.setChunkDecision(uri, 0, 'ours', 'accept')
            expect(mgr.getChunks(uri)[0].oursDecision).toBe('accept')
            expect(mgr.canUndo(uri)).toBe(true)

            mgr.undo(uri)
            expect(mgr.getChunks(uri)[0].oursDecision).toBeUndefined()
            expect(mgr.canUndo(uri)).toBe(false)
            expect(mgr.canRedo(uri)).toBe(true)
        })

        it('redo re-applies an undone decision', async () => {
            const { mgr } = await setupConflict()
            mgr.setChunkDecision(uri, 0, 'theirs', 'accept')
            mgr.undo(uri)
            expect(mgr.getChunks(uri)[0].theirsDecision).toBeUndefined()

            mgr.redo(uri)
            expect(mgr.getChunks(uri)[0].theirsDecision).toBe('accept')
            expect(mgr.canRedo(uri)).toBe(false)
        })

        it('undo walks back through multiple decisions one step at a time', async () => {
            const { mgr } = await setupConflict()
            mgr.setChunkDecision(uri, 0, 'ours', 'accept')
            mgr.setChunkDecision(uri, 0, 'theirs', 'discard')
            expect(mgr.getSessionState().files[0].resolvedChunks).toBe(1)

            mgr.undo(uri)
            // Theirs decision reverted; ours still set.
            expect(mgr.getChunks(uri)[0].oursDecision).toBe('accept')
            expect(mgr.getChunks(uri)[0].theirsDecision).toBeUndefined()

            mgr.undo(uri)
            expect(mgr.getChunks(uri)[0].oursDecision).toBeUndefined()
            expect(mgr.canUndo(uri)).toBe(false)
        })

        it('a new mutation after undo drops the redo stack', async () => {
            const { mgr } = await setupConflict()
            mgr.setChunkDecision(uri, 0, 'ours', 'accept')
            mgr.undo(uri)
            expect(mgr.canRedo(uri)).toBe(true)

            mgr.setChunkDecision(uri, 0, 'theirs', 'accept')
            expect(mgr.canRedo(uri)).toBe(false)
        })

        it('undo is a no-op when the stack is empty', async () => {
            const { mgr } = await setupConflict()
            const before = mgr.getChunks(uri).map((c) => ({ ...c }))
            mgr.undo(uri)
            expect(mgr.getChunks(uri)).toEqual(before)
            expect(mgr.canUndo(uri)).toBe(false)
        })

        it('redo is a no-op when the stack is empty', async () => {
            const { mgr } = await setupConflict()
            mgr.setChunkDecision(uri, 0, 'ours', 'accept')
            const before = mgr.getChunks(uri).map((c) => ({ ...c }))
            mgr.redo(uri)
            expect(mgr.getChunks(uri)).toEqual(before)
        })

        it('autoResolveNonConflicting collapses into a single undo entry', async () => {
            const git = makeGitService([{ fsPath: '/repo/foo.ts' }])
            // Two independent non-conflicting chunks (each side changes a
            // different region from base).
            git.getFileContents
                .mockResolvedValueOnce('A\nb\nc\nd\ne')
                .mockResolvedValueOnce('a\nb\nc\nd\ne')
                .mockResolvedValueOnce('a\nb\nc\nd\nE')
            const mgr = new MergeSessionManager(git as never)
            await mgr.refreshAll()

            expect(mgr.getChunks(uri)).toHaveLength(2)
            mgr.autoResolveNonConflicting(uri)
            expect(mgr.getSessionState().files[0].resolvedChunks).toBe(2)

            mgr.undo(uri)
            // Single undo step reverts the entire batch.
            expect(mgr.getSessionState().files[0].resolvedChunks).toBe(0)
            expect(mgr.canUndo(uri)).toBe(false)
        })

        it('setChunkManual is undoable', async () => {
            const { mgr } = await setupConflict()
            mgr.setChunkManual(uri, 0, ['custom'])
            expect(mgr.getChunks(uri)[0].manualLines).toEqual(['custom'])

            mgr.undo(uri)
            expect(mgr.getChunks(uri)[0].manualLines).toBeUndefined()
        })

        it('history is cleared when the file is re-parsed from disk', async () => {
            const { mgr, git } = await setupConflict()
            mgr.setChunkDecision(uri, 0, 'ours', 'accept')
            expect(mgr.canUndo(uri)).toBe(true)

            // Simulate a re-parse (e.g. doc change on disk).
            git.getFileContents
                .mockResolvedValueOnce('a\nX\nc')
                .mockResolvedValueOnce('a\nb\nc')
                .mockResolvedValueOnce('a\nY\nc')
            await mgr.refreshFile(
                { fsPath: '/repo/foo.ts', toString: () => '/repo/foo.ts' } as never
            )
            expect(mgr.canUndo(uri)).toBe(false)
            expect(mgr.canRedo(uri)).toBe(false)
        })

        it('undo history is per-file', async () => {
            const git = makeGitService([
                { fsPath: '/repo/a.ts' },
                { fsPath: '/repo/b.ts' },
            ])
            // file a: 1 conflict
            git.getFileContents
                .mockResolvedValueOnce('a\nX\nc')
                .mockResolvedValueOnce('a\nb\nc')
                .mockResolvedValueOnce('a\nY\nc')
                // file b: 1 conflict
                .mockResolvedValueOnce('p\nX\nr')
                .mockResolvedValueOnce('p\nq\nr')
                .mockResolvedValueOnce('p\nY\nr')
            const mgr = new MergeSessionManager(git as never)
            await mgr.refreshAll()

            const uriA = {
                fsPath: '/repo/a.ts',
                toString: () => '/repo/a.ts',
            } as never
            const uriB = {
                fsPath: '/repo/b.ts',
                toString: () => '/repo/b.ts',
            } as never

            mgr.setChunkDecision(uriA, 0, 'ours', 'accept')
            expect(mgr.canUndo(uriA)).toBe(true)
            expect(mgr.canUndo(uriB)).toBe(false)

            // Undoing on b does nothing to a.
            mgr.undo(uriB)
            expect(mgr.getChunks(uriA)[0].oursDecision).toBe('accept')
        })

        it('caps the undo stack length', async () => {
            const { mgr } = await setupConflict()
            // 60 mutations on a 50-entry cap. Oldest entries should be dropped.
            for (let i = 0; i < 60; i++) {
                mgr.setChunkDecision(
                    uri,
                    0,
                    'ours',
                    i % 2 === 0 ? 'accept' : 'discard'
                )
            }
            // Drain exactly 50 undos.
            for (let i = 0; i < 50; i++) {
                expect(mgr.canUndo(uri)).toBe(true)
                mgr.undo(uri)
            }
            expect(mgr.canUndo(uri)).toBe(false)
            // The 10 oldest snapshots were dropped, so the earliest reachable
            // state still has a decision set rather than the original
            // undecided state.
            expect(mgr.getChunks(uri)[0].oursDecision).toBeDefined()
        })
    })
})
