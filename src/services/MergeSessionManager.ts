import * as vscode from 'vscode'
import { parse } from '../parsers/ConflictParser'
import {
    isChunkResolved,
    type ConflictChunk,
    type SideDecision,
} from '../protocol'
import type { FileConflictState, SessionState } from '../types'
import type { GitService } from './GitService'

export class MergeSessionManager implements vscode.Disposable {
    private readonly _onDidSessionUpdate =
        new vscode.EventEmitter<SessionState>()
    readonly onDidSessionUpdate = this._onDidSessionUpdate.event

    private fileStates = new Map<
        string,
        FileConflictState & { chunks: ConflictChunk[] }
    >()
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
                    this.refreshFile(e.document.uri)
                }
            })
        )
    }

    async refreshAll(): Promise<void> {
        const changes = this.git.getMergeChanges()
        const nextKeys = new Set(changes.map((c) => c.uri.toString()))

        for (const key of this.fileStates.keys()) {
            if (!nextKeys.has(key)) this.fileStates.delete(key)
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
        state.chunks[chunkIndex] = { ...chunk, manualLines }
        state.resolvedChunks = state.chunks.filter(isChunkResolved).length
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    batchAccept(uri: vscode.Uri, side: 'ours' | 'theirs'): void {
        const state = this.fileStates.get(uri.toString())
        if (!state) return
        state.chunks = state.chunks.map((chunk) => {
            if (chunk.type !== 'conflict' || isChunkResolved(chunk)) return chunk
            return acceptOnly(chunk, side)
        })
        state.resolvedChunks = state.chunks.filter(isChunkResolved).length
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    autoResolveNonConflicting(uri: vscode.Uri): void {
        const state = this.fileStates.get(uri.toString())
        if (!state) return
        state.chunks = state.chunks.map((chunk) => {
            if (chunk.type !== 'non-conflicting' || isChunkResolved(chunk)) {
                return chunk
            }
            return acceptOnly(chunk, chunk.winner ?? 'ours')
        })
        state.resolvedChunks = state.chunks.filter(isChunkResolved).length
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    getChunks(uri: vscode.Uri): ConflictChunk[] {
        return this.fileStates.get(uri.toString())?.chunks ?? []
    }

    getSessionState(): SessionState {
        return { files: Array.from(this.fileStates.values()) }
    }

    dispose(): void {
        this.disposables.forEach((d) => d.dispose())
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
