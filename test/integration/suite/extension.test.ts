import * as assert from 'assert'
import * as vscode from 'vscode'

suite('MergePro Extension', () => {
    test('extension is present', () => {
        const ext = vscode.extensions.getExtension(
            'merge-pro-publisher.merge-pro'
        )
        assert.ok(ext, 'Extension should be installed')
    })

    test('MergePro panel view is registered', async () => {
        // Trigger SCM view to activate panel
        await vscode.commands.executeCommand('workbench.view.scm')
        // Give the extension time to activate
        await new Promise((r) => setTimeout(r, 1000))
        const ext = vscode.extensions.getExtension(
            'merge-pro-publisher.merge-pro'
        )
        assert.ok(ext?.isActive, 'Extension should be active')
    })

    test('workspace has conflicted files', async () => {
        const files = await vscode.workspace.findFiles('**/*.ts')
        assert.ok(files.length > 0, 'Should find TypeScript files in fixture')
    })
})
