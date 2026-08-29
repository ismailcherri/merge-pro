import * as assert from 'assert'
import * as vscode from 'vscode'

suite('MergePro Extension', () => {
    test('extension is present', () => {
        const ext = vscode.extensions.getExtension('ismailcherri.merge-pro')
        assert.ok(ext, 'Extension should be installed')
    })

    test('extension activates', async () => {
        const ext = vscode.extensions.getExtension('ismailcherri.merge-pro')
        await ext?.activate()
        assert.ok(ext?.isActive, 'Extension should be active')
    })

    test('workspace has conflicted files', async () => {
        const files = await vscode.workspace.findFiles('**/*.ts')
        assert.ok(files.length > 0, 'Should find TypeScript files in fixture')
    })
})
