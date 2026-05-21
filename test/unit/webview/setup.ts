import '@testing-library/jest-dom'

// monaco-editor's editor.main.js runs `document.queryCommandSupported()` at
// import time; jsdom doesn't ship it. Provide a no-op stub so any test that
// transitively imports monaco doesn't crash during module evaluation.
interface DocWithQuery {
    queryCommandSupported?: () => boolean
}
if (
    typeof document !== 'undefined' &&
    !(document as unknown as DocWithQuery).queryCommandSupported
) {
    ;(document as unknown as DocWithQuery).queryCommandSupported = () => false
}
