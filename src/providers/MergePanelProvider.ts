import * as vscode from 'vscode';
import type { MergeSessionManager } from '../services/MergeSessionManager';
import type { SessionState } from '../types';
import type { HostToPanel, PanelToHost, WebviewSessionState } from '../protocol';

export class MergePanelProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewId = 'mergePro.panel';

  private view?: vscode.WebviewView;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly session: MergeSessionManager,
  ) {
    this.disposables.push(
      session.onDidSessionUpdate((state) => this.postState(state)),
    );
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'out', 'webview')],
    };
    view.webview.html = this.getHtml(view.webview);

    this.disposables.push(
      view.webview.onDidReceiveMessage((msg: PanelToHost) => {
        vscode.commands.executeCommand('mergePro._panelMessage', msg);
      }),
    );

    // Push current state immediately
    this.postState(this.session.getSessionState());

    // Push initial state once the webview is ready
    setTimeout(() => {
      const state = this.session.getSessionState();
      this.postState(state);
    }, 100);
  }

  private buildWebviewState(activeEditorUri?: string): WebviewSessionState {
    const state = this.session.getSessionState();
    return {
      files: state.files.map((f) => ({
        uri: f.uri.toString(),
        fileName: f.fileName,
        totalChunks: f.totalChunks,
        resolvedChunks: f.resolvedChunks,
      })),
      activeEditorUri,
    };
  }

  private postState(_state: SessionState): void {
    if (!this.view) return;
    const msg: HostToPanel = { type: 'stateUpdate', state: this.buildWebviewState() };
    this.view.webview.postMessage(msg);
  }

  setActiveEditorUri(uri: string | undefined): void {
    if (!this.view) return;
    const msg: HostToPanel = { type: 'stateUpdate', state: this.buildWebviewState(uri) };
    this.view.webview.postMessage(msg);
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'out', 'webview', 'panel.js'),
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}
