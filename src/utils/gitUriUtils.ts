import * as vscode from 'vscode'

/** Builds a git: URI to read a file from the git index at a given stage. */
export function gitStageUri(fileUri: vscode.Uri, stage: 1 | 2 | 3): vscode.Uri {
    return fileUri.with({
        scheme: 'git',
        query: JSON.stringify({ path: fileUri.fsPath, ref: `:${stage}` }),
    })
}
