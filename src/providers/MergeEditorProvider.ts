import { randomBytes } from 'crypto'
import * as vscode from 'vscode'
import type { EditorToHost, HostToEditor } from '../protocol'
import type { GitService } from '../services/GitService'
import type { MergeSessionManager } from '../services/MergeSessionManager'

export class MergeEditorProvider implements vscode.Disposable {
    private panels = new Map<string, vscode.WebviewPanel>()
    private readonly disposables: vscode.Disposable[] = []

    constructor(
        private readonly extensionUri: vscode.Uri,
        private readonly git: GitService,
        private readonly session: MergeSessionManager
    ) {}

    async openEditor(uri: vscode.Uri): Promise<void> {
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

        const panelDisposables: vscode.Disposable[] = []

        panel.onDidDispose(
            () => {
                this.panels.delete(key)
                panelDisposables.forEach((d) => d.dispose())
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
                    this.sendChunkUpdate(panel, uri)
                } else if (msg.type === 'chunkResolvedManual') {
                    this.session.setChunkManual(
                        uri,
                        msg.chunkIndex,
                        msg.lines
                    )
                    this.sendChunkUpdate(panel, uri)
                } else if (msg.type === 'saveFile') {
                    try {
                        const hasUnresolved = /^<{7}( |\t)/m.test(msg.content)
                        if (hasUnresolved) {
                            const choice =
                                await vscode.window.showWarningMessage(
                                    'MergePro: File still contains unresolved conflict markers. Save anyway?',
                                    'Save',
                                    'Cancel'
                                )
                            if (choice !== 'Save') return
                        }
                        const bytes = Buffer.from(msg.content, 'utf8')
                        await vscode.workspace.fs.writeFile(uri, bytes)
                        if (!hasUnresolved) {
                            vscode.window.showInformationMessage(
                                `MergePro: Saved ${vscode.workspace.asRelativePath(uri)}`
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
        }
        panel.webview.postMessage(msg)
    }

    private sendChunkUpdate(panel: vscode.WebviewPanel, uri: vscode.Uri): void {
        const chunks = this.session.getChunks(uri)
        const msg: HostToEditor = { type: 'chunkUpdate', chunks }
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
            const entries =
                require('fs').readdirSync(assetsDir.fsPath) as string[]
            for (const name of entries) {
                if (!name.endsWith('.css')) continue
                const href = webview.asWebviewUri(
                    vscode.Uri.joinPath(assetsDir, name)
                )
                cssLinks += `\n  <link rel="stylesheet" href="${href}">`
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
  <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`
    }

    dispose(): void {
        this.panels.forEach((p) => p.dispose())
        this.disposables.forEach((d) => d.dispose())
    }
}

function getNonce(): string {
    return randomBytes(16).toString('base64url')
}
