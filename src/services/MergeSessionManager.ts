import * as vscode from 'vscode'
import { parse } from '../parsers/ConflictParser'
import {
    isChunkResolved,
    type ConflictChunk,
    type SideDecision,
} from '../protocol'
import type { FileConflictState, SessionState } from '../types'
import { magicMerge } from '../utils/magicMerge'
import type { GitService } from './GitService'

/** Snapshot of just the mutable decision metadata for every chunk in a file. */
type DecisionSnapshot = Array<
    Pick<ConflictChunk, 'oursDecision' | 'theirsDecision' | 'manualLines'>
>

const MAX_HISTORY = 50

export class MergeSessionManager implements vscode.Disposable {
    private readonly _onDidSessionUpdate =
        new vscode.EventEmitter<SessionState>()
    readonly onDidSessionUpdate = this._onDidSessionUpdate.event

    private fileStates = new Map<
        string,
        FileConflictState & { chunks: ConflictChunk[] }
    >()
    private undoStacks = new Map<string, DecisionSnapshot[]>()
    private redoStacks = new Map<string, DecisionSnapshot[]>()
    private readonly disposables: vscode.Disposable[] = []

    constructor(private readonly git: GitService) {
        this.disposables.push(this._onDidSessionUpdate)
        this.disposables.push(
            git.onDidMergeStateChange(() => this.refreshAll())
        )
        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument((e) => {
                const key = e.document.uri.toString()
                if (this.fileStates.has(key)) {
                    void this.refreshFile(e.document.uri)
                }
            })
        )
    }

    async refreshAll(): Promise<void> {
        const changes = this.git.getMergeChanges()
        const nextKeys = new Set(changes.map((c) => c.uri.toString()))

        for (const key of this.fileStates.keys()) {
            if (!nextKeys.has(key)) {
                this.fileStates.delete(key)
                this.undoStacks.delete(key)
                this.redoStacks.delete(key)
            }
        }

        await Promise.all(changes.map((c) => this.refreshFile(c.uri)))
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    async refreshFile(uri: vscode.Uri): Promise<void> {
        try {
            // During rebase, git swaps the meaning of stages 2/3 — HEAD is the
            // upstream commit, not the user's branch. Swap them back so the
            // "Ours" pane shows the user's work as IntelliJ does.
            const rebasing = this.git.isRebasing(uri)
            const oursStage = rebasing ? 3 : 2
            const theirsStage = rebasing ? 2 : 3
            const [oursText, baseText, theirsText] = await Promise.all([
                this.git.getFileContents(uri, oursStage),
                this.git.getFileContents(uri, 1),
                this.git.getFileContents(uri, theirsStage),
            ])
            const chunks = parse(oursText, baseText, theirsText)
            const existing = this.fileStates.get(uri.toString())
            // Re-parsing can reshape the chunk array; old snapshots may not
            // line up positionally. Drop history to keep undo predictable.
            this.undoStacks.delete(uri.toString())
            this.redoStacks.delete(uri.toString())

            const mergedChunks = chunks.map((chunk, i) => {
                const prev = existing?.chunks[i]
                if (prev && this.chunkMatchesPrev(chunk, prev)) {
                    return {
                        ...chunk,
                        oursDecision: prev.oursDecision,
                        theirsDecision: prev.theirsDecision,
                        manualLines: prev.manualLines,
                    }
                }
                return chunk
            })

            this.fileStates.set(uri.toString(), {
                uri,
                fileName: vscode.workspace.asRelativePath(uri),
                totalChunks: mergedChunks.length,
                resolvedChunks: mergedChunks.filter(isChunkResolved).length,
                chunks: mergedChunks,
            })
        } catch {
            this.fileStates.delete(uri.toString())
        }
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    private chunkMatchesPrev(
        current: ConflictChunk,
        prev: ConflictChunk
    ): boolean {
        return (
            current.baseStartLine === prev.baseStartLine &&
            current.baseEndLine === prev.baseEndLine &&
            current.type === prev.type
        )
    }

    setChunkDecision(
        uri: vscode.Uri,
        chunkIndex: number,
        side: 'ours' | 'theirs',
        decision: SideDecision
    ): void {
        const state = this.fileStates.get(uri.toString())
        const chunk = state?.chunks[chunkIndex]
        if (!state || !chunk) return
        this.pushUndoSnapshot(uri, state)
        const updated: ConflictChunk = { ...chunk }
        if (side === 'ours') updated.oursDecision = decision
        else updated.theirsDecision = decision
        // Setting an explicit per-side decision overrides any prior manual edit.
        delete updated.manualLines
        state.chunks[chunkIndex] = updated
        state.resolvedChunks = state.chunks.filter(isChunkResolved).length
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    setChunkManual(
        uri: vscode.Uri,
        chunkIndex: number,
        manualLines: string[]
    ): void {
        const state = this.fileStates.get(uri.toString())
        const chunk = state?.chunks[chunkIndex]
        if (!state || !chunk) return
        this.pushUndoSnapshot(uri, state)
        state.chunks[chunkIndex] = { ...chunk, manualLines }
        state.resolvedChunks = state.chunks.filter(isChunkResolved).length
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    batchAccept(uri: vscode.Uri, side: 'ours' | 'theirs'): void {
        const state = this.fileStates.get(uri.toString())
        if (!state) return
        this.pushUndoSnapshot(uri, state)
        state.chunks = state.chunks.map((chunk) => {
            if (chunk.type !== 'conflict' || isChunkResolved(chunk))
                return chunk
            return acceptOnly(chunk, side)
        })
        state.resolvedChunks = state.chunks.filter(isChunkResolved).length
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    /**
     * Magic-merge a single chunk if its two sides can be combined safely.
     * No-op if the chunk is already resolved or magicMerge returns null.
     */
    magicResolveChunk(uri: vscode.Uri, chunkIndex: number): void {
        const state = this.fileStates.get(uri.toString())
        const chunk = state?.chunks[chunkIndex]
        if (!state || !chunk || isChunkResolved(chunk)) return
        // The wand is conflict-only. Non-conflicting chunks belong to
        // Auto-Resolve and should not also count as "magic".
        if (chunk.type !== 'conflict') return
        const merged = magicMerge(
            chunk.baseLines,
            chunk.oursLines,
            chunk.theirsLines
        )
        if (merged === null) return
        this.pushUndoSnapshot(uri, state)
        state.chunks[chunkIndex] = { ...chunk, manualLines: merged }
        state.resolvedChunks = state.chunks.filter(isChunkResolved).length
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    /**
     * Attempt to auto-resolve every still-unresolved conflict chunk by
     * running a line-level three-way merge inside the chunk. Chunks where
     * the two sides' edits are line-disjoint (or identical) get `manualLines`
     * set with the woven result. Chunks that genuinely conflict are left
     * untouched. All successful resolutions land as a single undo entry.
     */
    magicResolve(uri: vscode.Uri): void {
        const state = this.fileStates.get(uri.toString())
        if (!state) return
        // Snapshot before touching anything so a single undo reverts the
        // whole wand pass — even if no chunk ends up changing, the entry is
        // a cheap noop and we drop it below in that case.
        const before = this.snapshotDecisions(state.chunks)
        let changed = false
        state.chunks = state.chunks.map((chunk) => {
            if (isChunkResolved(chunk)) return chunk
            // Conflict-only: Auto-Resolve owns non-conflicting chunks.
            if (chunk.type !== 'conflict') return chunk
            const merged = magicMerge(
                chunk.baseLines,
                chunk.oursLines,
                chunk.theirsLines
            )
            if (merged === null) return chunk
            changed = true
            return { ...chunk, manualLines: merged }
        })
        if (!changed) return
        // Push the pre-mutation snapshot now that we know something changed.
        const key = uri.toString()
        const stack = this.undoStacks.get(key) ?? []
        stack.push(before)
        if (stack.length > MAX_HISTORY) stack.shift()
        this.undoStacks.set(key, stack)
        this.redoStacks.delete(key)
        state.resolvedChunks = state.chunks.filter(isChunkResolved).length
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    autoResolveNonConflicting(uri: vscode.Uri): void {
        const state = this.fileStates.get(uri.toString())
        if (!state) return
        this.pushUndoSnapshot(uri, state)
        state.chunks = state.chunks.map((chunk) => {
            if (chunk.type !== 'non-conflicting' || isChunkResolved(chunk)) {
                return chunk
            }
            return acceptOnly(chunk, chunk.winner ?? 'ours')
        })
        state.resolvedChunks = state.chunks.filter(isChunkResolved).length
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    /**
     * Snapshot the per-chunk decision metadata before a mutation so it can be
     * undone. Any pending redo history is dropped — the standard editor-style
     * behavior where a new action invalidates the redo branch.
     */
    private pushUndoSnapshot(
        uri: vscode.Uri,
        state: FileConflictState & { chunks: ConflictChunk[] }
    ): void {
        const key = uri.toString()
        const snapshot = this.snapshotDecisions(state.chunks)
        const stack = this.undoStacks.get(key) ?? []
        stack.push(snapshot)
        if (stack.length > MAX_HISTORY) stack.shift()
        this.undoStacks.set(key, stack)
        this.redoStacks.delete(key)
    }

    private snapshotDecisions(chunks: ConflictChunk[]): DecisionSnapshot {
        return chunks.map((c) => ({
            oursDecision: c.oursDecision,
            theirsDecision: c.theirsDecision,
            manualLines: c.manualLines,
        }))
    }

    private applySnapshot(
        state: FileConflictState & { chunks: ConflictChunk[] },
        snapshot: DecisionSnapshot
    ): void {
        // Snapshot length always matches state.chunks.length because history
        // is dropped whenever chunks are re-parsed from disk.
        state.chunks = state.chunks.map((chunk, i) => {
            const s = snapshot[i]
            const next: ConflictChunk = {
                ...chunk,
                oursDecision: s?.oursDecision,
                theirsDecision: s?.theirsDecision,
                manualLines: s?.manualLines,
            }
            if (next.oursDecision === undefined) delete next.oursDecision
            if (next.theirsDecision === undefined) delete next.theirsDecision
            if (next.manualLines === undefined) delete next.manualLines
            return next
        })
        state.resolvedChunks = state.chunks.filter(isChunkResolved).length
    }

    undo(uri: vscode.Uri): void {
        const key = uri.toString()
        const state = this.fileStates.get(key)
        const undoStack = this.undoStacks.get(key)
        if (!state || !undoStack || undoStack.length === 0) return
        const prev = undoStack.pop()!
        const redoStack = this.redoStacks.get(key) ?? []
        redoStack.push(this.snapshotDecisions(state.chunks))
        if (redoStack.length > MAX_HISTORY) redoStack.shift()
        this.redoStacks.set(key, redoStack)
        this.applySnapshot(state, prev)
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    redo(uri: vscode.Uri): void {
        const key = uri.toString()
        const state = this.fileStates.get(key)
        const redoStack = this.redoStacks.get(key)
        if (!state || !redoStack || redoStack.length === 0) return
        const next = redoStack.pop()!
        const undoStack = this.undoStacks.get(key) ?? []
        undoStack.push(this.snapshotDecisions(state.chunks))
        if (undoStack.length > MAX_HISTORY) undoStack.shift()
        this.undoStacks.set(key, undoStack)
        this.applySnapshot(state, next)
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    canUndo(uri: vscode.Uri): boolean {
        return (this.undoStacks.get(uri.toString())?.length ?? 0) > 0
    }

    canRedo(uri: vscode.Uri): boolean {
        return (this.redoStacks.get(uri.toString())?.length ?? 0) > 0
    }

    getChunks(uri: vscode.Uri): ConflictChunk[] {
        return this.fileStates.get(uri.toString())?.chunks ?? []
    }

    getSessionState(): SessionState {
        return { files: Array.from(this.fileStates.values()) }
    }

    dispose(): void {
        this.disposables.forEach((d) => {
            d.dispose()
        })
    }
}

function acceptOnly(
    chunk: ConflictChunk,
    side: 'ours' | 'theirs'
): ConflictChunk {
    return {
        ...chunk,
        oursDecision: side === 'ours' ? 'accept' : 'discard',
        theirsDecision: side === 'theirs' ? 'accept' : 'discard',
        manualLines: undefined,
    }
}
