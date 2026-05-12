import { existsSync } from 'fs'
import { join } from 'path'
import * as vscode from 'vscode'
import type { MergeChange } from '../types'

// Type stubs for the vscode.git extension API (not exported publicly)
interface GitExtensionAPI {
    getAPI(version: 1): GitAPI
}
interface GitAPI {
    repositories: Repository[]
    onDidOpenRepository: vscode.Event<Repository>
}
interface Repository {
    rootUri: vscode.Uri
    state: RepositoryState
}
interface RepositoryState {
    mergeChanges: Change[]
    onDidChange: vscode.Event<void>
}
interface Change {
    uri: vscode.Uri
    originalUri: vscode.Uri
    renameUri: vscode.Uri | undefined
    status: number
}

export class GitService implements vscode.Disposable {
    private readonly _onDidMergeStateChange = new vscode.EventEmitter<
        MergeChange[]
    >()
    readonly onDidMergeStateChange = this._onDidMergeStateChange.event

    private gitAPI: GitAPI | undefined
    private readonly repoDisposables = new Map<string, vscode.Disposable>()
    private initing = false
    private readonly disposables: vscode.Disposable[] = []

    constructor() {
        this.disposables.push(this._onDidMergeStateChange)
        this.init()
    }

    private init(): void {
        if (this.initing) return
        this.initing = true

        const ext =
            vscode.extensions.getExtension<GitExtensionAPI>('vscode.git')
        if (!ext) {
            vscode.window.showWarningMessage(
                'MergePro: Git extension not found.'
            )
            this.initing = false
            return
        }
        const activate: Promise<GitExtensionAPI> = ext.isActive
            ? Promise.resolve(ext.exports)
            : Promise.resolve(ext.activate())

        activate
            .then((exports) => {
                this.gitAPI = exports.getAPI(1)
                this.initing = false
                this.watchRepositories()
            })
            .catch((err) => {
                this.initing = false
                vscode.window.showWarningMessage(
                    `MergePro: Failed to activate Git extension. ${err}`
                )
            })

        // Re-try if git extension activates later
        this.disposables.push(
            vscode.extensions.onDidChange(() => {
                if (!this.gitAPI) this.init()
            })
        )
    }

    private watchRepositories(): void {
        if (!this.gitAPI) return

        for (const repo of this.gitAPI.repositories) {
            this.watchRepo(repo)
        }

        this.disposables.push(
            this.gitAPI.onDidOpenRepository((repo) => this.watchRepo(repo))
        )
    }

    private watchRepo(repo: Repository): void {
        const key = repo.rootUri.toString()
        this.repoDisposables.get(key)?.dispose()
        const disposable = repo.state.onDidChange(() => {
            this._onDidMergeStateChange.fire(this.toMergeChanges(repo))
        })
        this.repoDisposables.set(key, disposable)
        this.disposables.push(disposable)
        // Fire immediately to populate initial state
        this._onDidMergeStateChange.fire(this.toMergeChanges(repo))
    }

    private toMergeChanges(repo: Repository): MergeChange[] {
        return repo.state.mergeChanges.map((c) => ({
            uri: c.uri,
            fileName: vscode.workspace.asRelativePath(c.uri),
        }))
    }

    getMergeChanges(): MergeChange[] {
        if (!this.gitAPI) return []
        const repo = this.gitAPI.repositories[0]
        if (!repo) return []
        return this.toMergeChanges(repo)
    }

    /**
     * True when the repo containing `uri` (or the first repo, if no uri given)
     * is in the middle of a `git rebase`. During rebase git swaps the meaning
     * of stage 2/3: HEAD is the upstream commit and MERGE_HEAD-equivalents are
     * the commits being replayed. Callers use this to swap "ours"/"theirs"
     * pane assignments to match user intuition (and IntelliJ).
     */
    isRebasing(uri?: vscode.Uri): boolean {
        const repo = this.repoFor(uri) ?? this.gitAPI?.repositories[0]
        if (!repo) return false
        const gitDir = join(repo.rootUri.fsPath, '.git')
        return (
            existsSync(join(gitDir, 'rebase-merge')) ||
            existsSync(join(gitDir, 'rebase-apply'))
        )
    }

    private repoFor(uri?: vscode.Uri): Repository | undefined {
        if (!uri || !this.gitAPI) return undefined
        return this.gitAPI.repositories.find((r) =>
            uri.fsPath.startsWith(r.rootUri.fsPath)
        )
    }

    async getFileContents(uri: vscode.Uri, stage: 1 | 2 | 3): Promise<string> {
        // Use git index URI scheme: git:<path>?{"path":"...","ref":":N"}
        const gitUri = uri.with({
            scheme: 'git',
            query: JSON.stringify({ path: uri.fsPath, ref: `:${stage}` }),
        })
        const bytes = await vscode.workspace.fs.readFile(gitUri)
        return Buffer.from(bytes).toString('utf8')
    }

    dispose(): void {
        this.repoDisposables.forEach((d) => {
            d.dispose()
        })
        this.repoDisposables.clear()
        this.disposables.forEach((d) => {
            d.dispose()
        })
    }
}
