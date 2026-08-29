import { runTests } from '@vscode/test-electron'
import * as path from 'path'

async function main(): Promise<void> {
    const projectRoot = path.resolve(__dirname, '../../..')
    const extensionDevelopmentPath = projectRoot
    const extensionTestsPath = path.resolve(__dirname, './suite/index')
    const workspacePath = path.resolve(
        projectRoot,
        'test-fixtures/conflict-repo/repo'
    )

    await runTests({
        extensionDevelopmentPath,
        extensionTestsPath,
        launchArgs: [workspacePath],
    })
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
