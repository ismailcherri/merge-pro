/// <reference types="vite/client" />

// Import Monaco workers as inline blob workers so they work inside the VS Code
// webview's special URL scheme (vscode-resource://). The CSP must include
// `worker-src blob:` for these to be created.
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline'

// This must run before any monaco-editor import so Monaco picks up the
// environment when it lazily creates workers for the first model.
globalThis.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string): Worker {
        if (label === 'json') return new JsonWorker()
        return new EditorWorker()
    },
}
