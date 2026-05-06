import type { PanelToHost } from '../../src/protocol'

declare function acquireVsCodeApi(): {
    postMessage: (msg: PanelToHost) => void
    getState: () => unknown
    setState: (state: unknown) => void
}

const vscode = acquireVsCodeApi()
export default vscode
