import * as vscode from 'vscode'
import { parse } from '../parsers/ConflictParser'
import type { ConflictChunk } from '../protocol'
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

        // Remove resolved files
        for (const key of this.fileStates.keys()) {
            if (!nextKeys.has(key)) this.fileStates.delete(key)
        }

        await Promise.all(changes.map((c) => this.refreshFile(c.uri)))
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    async refreshFile(uri: vscode.Uri): Promise<void> {
        try {
            const [oursText, baseText, theirsText] = await Promise.all([
                this.git.getFileContents(uri, 2),
                this.git.getFileContents(uri, 1),
                this.git.getFileContents(uri, 3),
            ])
            const chunks = parse(oursText, baseText, theirsText)
            const existing = this.fileStates.get(uri.toString())

            // Preserve resolved state for chunks that still exist at the same position
            const mergedChunks = chunks.map((chunk, i) => {
                const prev = existing?.chunks[i]
                if (
                    prev?.resolvedWith &&
                    this.chunkMatchesResolved(chunk, prev)
                ) {
                    return {
                        ...chunk,
                        resolvedWith: prev.resolvedWith,
                        manualLines: prev.manualLines,
                    }
                }
                return chunk
            })

            this.fileStates.set(uri.toString(), {
                uri,
                fileName: vscode.workspace.asRelativePath(uri),
                totalChunks: mergedChunks.length,
                resolvedChunks: mergedChunks.filter(
                    (c) => c.resolvedWith !== undefined
                ).length,
                chunks: mergedChunks,
            })
        } catch {
            // File may have been fully resolved — remove it
            this.fileStates.delete(uri.toString())
        }
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    private chunkMatchesResolved(
        current: ConflictChunk,
        prev: ConflictChunk
    ): boolean {
        return (
            current.baseStartLine === prev.baseStartLine &&
            current.baseEndLine === prev.baseEndLine &&
            current.type === prev.type
        )
    }

    resolveChunk(
        uri: vscode.Uri,
        chunkIndex: number,
        decision: 'ours' | 'theirs' | 'manual',
        manualLines?: string[]
    ): void {
        const state = this.fileStates.get(uri.toString())
        if (!state || !state.chunks[chunkIndex]) return

        state.chunks[chunkIndex] = {
            ...state.chunks[chunkIndex],
            resolvedWith: decision,
            manualLines,
        }
        state.resolvedChunks = state.chunks.filter(
            (c) => c.resolvedWith !== undefined
        ).length
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    batchAccept(uri: vscode.Uri, side: 'ours' | 'theirs'): void {
        const state = this.fileStates.get(uri.toString())
        if (!state) return
        state.chunks = state.chunks.map((chunk) =>
            chunk.type === 'conflict' && chunk.resolvedWith === undefined
                ? { ...chunk, resolvedWith: side }
                : chunk
        )
        state.resolvedChunks = state.chunks.filter(
            (c) => c.resolvedWith !== undefined
        ).length
        this._onDidSessionUpdate.fire(this.getSessionState())
    }

    autoResolveNonConflicting(uri: vscode.Uri): void {
        const state = this.fileStates.get(uri.toString())
        if (!state) return
        state.chunks = state.chunks.map((chunk) => {
            if (
                chunk.type === 'non-conflicting' &&
                chunk.resolvedWith === undefined
            ) {
                const side: 'ours' | 'theirs' = chunk.winner ?? 'ours'
                return { ...chunk, resolvedWith: side }
            }
            return chunk
        })
        state.resolvedChunks = state.chunks.filter(
            (c) => c.resolvedWith !== undefined
        ).length
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
