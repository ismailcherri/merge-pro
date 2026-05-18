import { randomBytes } from 'crypto'
import { readdirSync } from 'fs'
import * as vscode from 'vscode'
import type { EditorToHost, HostToEditor } from '../protocol'
import type { GitService } from '../services/GitService'
import type { MergeSessionManager } from '../services/MergeSessionManager'

export class MergeEditorProvider implements vscode.Disposable {
    private panels = new Map<string, vscode.WebviewPanel>()
    private dirty = new Map<string, boolean>()
    private activeUri: string | undefined
    private readonly _onDidChangeActiveEditor = new vscode.EventEmitter<
        string | undefined
    >()
    readonly onDidChangeActiveEditor = this._onDidChangeActiveEditor.event
    private readonly disposables: vscode.Disposable[] = [
        this._onDidChangeActiveEditor,
    ]

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly git: GitService,
        private readonly session: MergeSessionManager
    ) {}

    openEditor(uri: vscode.Uri): void {
        const key = uri.toString()

        // Reuse existing panel if open
        const existing = this.panels.get(key)
        if (existing) {
            existing.reveal()
            return
        }

        const panel = vscode.window.createWebviewPanel(
            'mergePro.editor',
            `MergePro: ${vscode.workspace.asRelativePath(uri)}`,
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.extensionUri, 'out', 'webview'),
                ],
                retainContextWhenHidden: true,
            }
        )

        this.panels.set(key, panel)
        this.setActive(key)

        const panelDisposables: vscode.Disposable[] = []

        panel.onDidChangeViewState(
            () => {
                if (panel.active) {
                    this.setActive(key)
                } else if (this.activeUri === key) {
                    this.setActive(undefined)
                }
            },
            null,
            panelDisposables
        )

        panel.onDidDispose(
            () => {
                this.panels.delete(key)
                if (this.activeUri === key) {
                    this.setActive(undefined)
                }
                if (this.dirty.get(key)) {
                    this.dirty.delete(key)
                    void this.warnUnsaved(uri)
                } else {
                    this.dirty.delete(key)
                }
                panelDisposables.forEach((d) => {
                    d.dispose()
                })
            },
            null,
            panelDisposables
        )

        panel.webview.html = this.getHtml(panel.webview)

        // Wait for webview to signal ready, then send init data
        panel.webview.onDidReceiveMessage(
            async (msg: EditorToHost) => {
                if (msg.type === 'ready') {
                    try {
                        await this.sendInit(panel, uri)
                    } catch (err) {
                        vscode.window.showErrorMessage(
                            `MergePro: Failed to load merge data — ${String(err)}`
                        )
                    }
                } else if (msg.type === 'chunkDecision') {
                    this.session.setChunkDecision(
                        uri,
                        msg.chunkIndex,
                        msg.side,
                        msg.decision
                    )
                    this.dirty.set(key, true)
                    this.sendChunkUpdate(panel, uri)
                } else if (msg.type === 'chunkResolvedManual') {
                    this.session.setChunkManual(uri, msg.chunkIndex, msg.lines)
                    this.dirty.set(key, true)
                    this.sendChunkUpdate(panel, uri)
                } else if (msg.type === 'autoResolve') {
                    this.session.autoResolveNonConflicting(uri)
                    this.dirty.set(key, true)
                    this.sendChunkUpdate(panel, uri)
                } else if (msg.type === 'magicResolve') {
                    this.session.magicResolve(uri)
                    this.dirty.set(key, true)
                    this.sendChunkUpdate(panel, uri)
                } else if (msg.type === 'magicResolveChunk') {
                    this.session.magicResolveChunk(uri, msg.chunkIndex)
                    this.dirty.set(key, true)
                    this.sendChunkUpdate(panel, uri)
                } else if (msg.type === 'undo') {
                    this.session.undo(uri)
                    this.dirty.set(key, true)
                    this.sendChunkUpdate(panel, uri)
                } else if (msg.type === 'redo') {
                    this.session.redo(uri)
                    this.dirty.set(key, true)
                    this.sendChunkUpdate(panel, uri)
                } else if (msg.type === 'saveFile') {
                    try {
                        const markerMatches =
                            msg.content.match(/^<{7}( |\t)/gm) ?? []
                        const hasUnresolved = markerMatches.length > 0
                        if (hasUnresolved) {
                            const fileName =
                                vscode.workspace.asRelativePath(uri)
                            const n = markerMatches.length
                            const choice =
                                await vscode.window.showWarningMessage(
                                    `${fileName} still has ${n} unresolved conflict${n === 1 ? '' : 's'}.`,
                                    {
                                        modal: true,
                                        detail: 'Saving now will write the conflict markers to disk and the file will NOT be staged. Resolve all conflicts before saving.',
                                    },
                                    'Save Anyway'
                                )
                            if (choice !== 'Save Anyway') return
                        }
                        const bytes = Buffer.from(msg.content, 'utf8')
                        await vscode.workspace.fs.writeFile(uri, bytes)
                        this.dirty.set(key, false)
                        if (!hasUnresolved) {
                            // Stage the file so VS Code's Source Control panel
                            // moves it out of "Merge Changes" — equivalent to
                            // `git add <path>`. Only do this once the file is
                            // marker-free; staging a half-resolved file would
                            // be wrong.
                            try {
                                await this.git.stageFile(uri)
                            } catch (stageErr) {
                                vscode.window.showWarningMessage(
                                    `MergePro: Saved, but failed to stage — ${String(stageErr)}`
                                )
                            }
                            vscode.window.showInformationMessage(
                                `MergePro: Resolved ${vscode.workspace.asRelativePath(uri)}`
                            )
                        }
                    } catch (err) {
                        vscode.window.showErrorMessage(
                            `MergePro: Failed to save — ${String(err)}`
                        )
                    }
                }
            },
            null,
            panelDisposables
        )
    }

    private setActive(uri: string | undefined): void {
        if (this.activeUri === uri) return
        this.activeUri = uri
        this._onDidChangeActiveEditor.fire(uri)
    }

    private async warnUnsaved(uri: vscode.Uri): Promise<void> {
        const fileName = vscode.workspace.asRelativePath(uri)
        const choice = await vscode.window.showWarningMessage(
            `MergePro: You closed the merge editor for ${fileName} with unsaved changes. Your decisions are kept in this session.`,
            'Reopen'
        )
        if (choice === 'Reopen') this.openEditor(uri)
    }

    private async sendInit(
        panel: vscode.WebviewPanel,
        uri: vscode.Uri
    ): Promise<void> {
        const rebasing = this.git.isRebasing(uri)
        const oursStage = rebasing ? 3 : 2
        const theirsStage = rebasing ? 2 : 3
        const [oursText, baseText, theirsText] = await Promise.all([
            this.git.getFileContents(uri, oursStage),
            this.git.getFileContents(uri, 1),
            this.git.getFileContents(uri, theirsStage),
        ])
        const chunks = this.session.getChunks(uri)
        const msg: HostToEditor = {
            type: 'init',
            oursText,
            baseText,
            theirsText,
            chunks,
            fileName: vscode.workspace.asRelativePath(uri),
            uri: uri.toString(),
            canUndo: this.session.canUndo(uri),
            canRedo: this.session.canRedo(uri),
        }
        panel.webview.postMessage(msg)
    }

    private sendChunkUpdate(panel: vscode.WebviewPanel, uri: vscode.Uri): void {
        const chunks = this.session.getChunks(uri)
        const msg: HostToEditor = {
            type: 'chunkUpdate',
            chunks,
            canUndo: this.session.canUndo(uri),
            canRedo: this.session.canRedo(uri),
        }
        panel.webview.postMessage(msg)
    }

    private getHtml(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(
                this.extensionUri,
                'out',
                'webview',
                'editor.js'
            )
        )
        // Vite emits Monaco's CSS into out/webview/assets/*.css. The bundled
        // editor.js does not auto-load it (we ship a hand-written HTML host
        // rather than Vite's generated index.html), so we discover all CSS
        // assets at request time and link them.
        const assetsDir = vscode.Uri.joinPath(
            this.extensionUri,
            'out',
            'webview',
            'assets'
        )
        let cssLinks = ''
        try {
            const entries = readdirSync(assetsDir.fsPath)
            for (const name of entries) {
                if (!name.endsWith('.css')) continue
                const href = webview.asWebviewUri(
                    vscode.Uri.joinPath(assetsDir, name)
                )
                cssLinks += `\n  <link rel="stylesheet" href="${href.toString()}">`
            }
        } catch {
            // Build hasn't run or the dir is missing — webview will still load
            // but Monaco styling will be absent.
        }
        const nonce = getNonce()
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'strict-dynamic'; style-src ${webview.cspSource} 'unsafe-inline'; font-src data:; worker-src blob:; img-src data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">${cssLinks}
  <style>body, html { margin:0; padding:0; height:100%; overflow:hidden; } #root { height:100%; }</style>
</head>
<body>
  <div id="root"></div>
  <script type="module" nonce="${nonce}" src="${scriptUri.toString()}"></script>
</body>
</html>`
    }

    dispose(): void {
        this.panels.forEach((p) => {
            p.dispose()
        })
        this.disposables.forEach((d) => {
            d.dispose()
        })
    }
}

function getNonce(): string {
    return randomBytes(16).toString('base64url')
}
