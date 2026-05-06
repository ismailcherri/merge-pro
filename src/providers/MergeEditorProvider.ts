import * as vscode from 'vscode';
import type { MergeSessionManager } from '../services/MergeSessionManager';
import type { GitService } from '../services/GitService';
import type { HostToEditor, EditorToHost } from '../protocol';

export class MergeEditorProvider implements vscode.Disposable {
  private panels = new Map<string, vscode.WebviewPanel>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly git: GitService,
    private readonly session: MergeSessionManager,
  ) {}

  async openEditor(uri: vscode.Uri): Promise<void> {
    const key = uri.toString();

    // Reuse existing panel if open
    const existing = this.panels.get(key);
    if (existing) {
      existing.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'mergePro.editor',
      `MergePro: ${vscode.workspace.asRelativePath(uri)}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out', 'webview')],
        retainContextWhenHidden: true,
      },
    );

    this.panels.set(key, panel);
    panel.onDidDispose(() => this.panels.delete(key));
    panel.webview.html = this.getHtml(panel.webview);

    // Wait for webview to signal ready, then send init data
    panel.webview.onDidReceiveMessage(async (msg: EditorToHost) => {
      if (msg.type === 'ready') {
        await this.sendInit(panel, uri);
      } else if (msg.type === 'chunkResolved') {
        this.session.resolveChunk(uri, msg.chunkIndex, msg.decision);
        this.sendChunkUpdate(panel, uri);
      } else if (msg.type === 'chunkResolvedManual') {
        this.session.resolveChunk(uri, msg.chunkIndex, 'manual', msg.lines);
        this.sendChunkUpdate(panel, uri);
      } else if (msg.type === 'saveFile') {
        const bytes = Buffer.from(msg.content, 'utf8');
        await vscode.workspace.fs.writeFile(uri, bytes);
        vscode.window.showInformationMessage(`MergePro: Saved ${vscode.workspace.asRelativePath(uri)}`);
      }
    });
  }

  private async sendInit(panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
    const [oursText, baseText, theirsText] = await Promise.all([
      this.git.getFileContents(uri, 2),
      this.git.getFileContents(uri, 1),
      this.git.getFileContents(uri, 3),
    ]);
    const chunks = this.session.getChunks(uri);
    const msg: HostToEditor = {
      type: 'init',
      oursText,
      baseText,
      theirsText,
      chunks,
      fileName: vscode.workspace.asRelativePath(uri),
      uri: uri.toString(),
    };
    panel.webview.postMessage(msg);
  }

  private sendChunkUpdate(panel: vscode.WebviewPanel, uri: vscode.Uri): void {
    const chunks = this.session.getChunks(uri);
    const msg: HostToEditor = { type: 'chunkUpdate', chunks };
    panel.webview.postMessage(msg);
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'editor.js'),
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src 'unsafe-inline'; font-src data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body, html { margin:0; padding:0; height:100%; overflow:hidden; } #root { height:100%; }</style>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    this.panels.forEach((p) => p.dispose());
    this.disposables.forEach((d) => d.dispose());
  }
}

function getNonce(): string {
  let t = '';
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) t += c.charAt(Math.floor(Math.random() * c.length));
  return t;
}
