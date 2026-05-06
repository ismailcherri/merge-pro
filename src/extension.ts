import * as vscode from 'vscode';
import { GitService } from './services/GitService';
import { MergeSessionManager } from './services/MergeSessionManager';
import { MergePanelProvider } from './providers/MergePanelProvider';
import type { PanelToHost } from './protocol';

export function activate(context: vscode.ExtensionContext): void {
  const git = new GitService();
  const session = new MergeSessionManager(git);
  const panel = new MergePanelProvider(context.extensionUri, session);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(MergePanelProvider.viewId, panel),

    // Internal command used by MergePanelProvider to relay panel messages
    vscode.commands.registerCommand('mergePro._panelMessage', (msg: PanelToHost) => {
      if (msg.type === 'openEditor') {
        vscode.window.showInformationMessage(`MergePro editor for ${msg.uri} — coming in Sprint 3.`);
      }
      // batchAccept and autoResolve wired in Sprint 4
    }),

    vscode.commands.registerCommand('mergePro.openEditor', () => {}),
    vscode.commands.registerCommand('mergePro.prevConflict', () => {}),
    vscode.commands.registerCommand('mergePro.nextConflict', () => {}),

    git,
    session,
    panel,
  );
}

export function deactivate(): void {}
