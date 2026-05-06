import * as vscode from 'vscode';
import { GitService } from './services/GitService';
import { MergeSessionManager } from './services/MergeSessionManager';

export function activate(context: vscode.ExtensionContext): void {
  const git = new GitService();
  const session = new MergeSessionManager(git);

  // Placeholder commands — implemented in Sprint 2 & 3
  context.subscriptions.push(
    vscode.commands.registerCommand('mergePro.openEditor', () => {
      vscode.window.showInformationMessage('MergePro editor coming in Sprint 3.');
    }),
    vscode.commands.registerCommand('mergePro.prevConflict', () => {}),
    vscode.commands.registerCommand('mergePro.nextConflict', () => {}),
    git,
    session,
  );
}

export function deactivate(): void {}
