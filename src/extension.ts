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

        vscode.commands.registerCommand(
            'mergePro._panelMessage',
            async (msg: PanelToHost) => {
                if (msg.type === 'openEditor') {
                    const uri = vscode.Uri.parse(msg.uri)
                    await editor.openEditor(uri)
                    panel.setActiveEditorUri(msg.uri)
                } else if (msg.type === 'batchAccept') {
                    const uri = vscode.Uri.parse(msg.uri)
                    session.batchAccept(uri, msg.side)
                } else if (msg.type === 'autoResolve') {
                    const uri = vscode.Uri.parse(msg.uri)
                    session.autoResolveNonConflicting(uri)
                }
            }
        ),

        vscode.commands.registerCommand('mergePro.openEditor', async () => {
            const active = vscode.window.activeTextEditor?.document.uri
            if (active) await editor.openEditor(active)
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

export function deactivate(): void {}
