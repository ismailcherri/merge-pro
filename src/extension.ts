import * as vscode from 'vscode'
import type { PanelToHost } from './protocol'
import { MergeEditorProvider } from './providers/MergeEditorProvider'
import { MergePanelProvider } from './providers/MergePanelProvider'
import { GitService } from './services/GitService'
import { MergeSessionManager } from './services/MergeSessionManager'

export function activate(context: vscode.ExtensionContext): void {
    const git = new GitService()
    const session = new MergeSessionManager(git)
    const panel = new MergePanelProvider(context.extensionUri, session)
    const editor = new MergeEditorProvider(context.extensionUri, git, session)

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            MergePanelProvider.viewId,
            panel
        ),

        editor.onDidChangeActiveEditor((uri) => panel.setActiveEditorUri(uri)),

        vscode.commands.registerCommand(
            'mergePro._panelMessage',
            (msg: PanelToHost) => {
                if (msg.type === 'openEditor') {
                    const uri = vscode.Uri.parse(msg.uri)
                    editor.openEditor(uri)
                } else if (msg.type === 'batchAccept') {
                    const uri = vscode.Uri.parse(msg.uri)
                    session.batchAccept(uri, msg.side)
                } else if (msg.type === 'autoResolve') {
                    const uri = vscode.Uri.parse(msg.uri)
                    session.autoResolveNonConflicting(uri)
                }
            }
        ),

        vscode.commands.registerCommand('mergePro.openEditor', () => {
            const active = vscode.window.activeTextEditor?.document.uri
            if (active) editor.openEditor(active)
        }),

        vscode.commands.registerCommand('mergePro.prevConflict', () =>
            vscode.commands.executeCommand('mergePro._navigate', -1)
        ),
        vscode.commands.registerCommand('mergePro.nextConflict', () =>
            vscode.commands.executeCommand('mergePro._navigate', 1)
        ),

        git,
        session,
        panel,
        editor
    )
}

export function deactivate(): void {
    // No-op: subscriptions registered on context handle their own cleanup.
}
