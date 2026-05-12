import * as monaco from 'monaco-editor'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

export interface EditorPaneHandle {
    getEditor(): monaco.editor.IStandaloneCodeEditor | null
}

interface Props {
    value: string
    language: string
    readOnly: boolean
    decorations: monaco.editor.IModelDeltaDecoration[]
    showScrollbar?: boolean
    onScroll?: (scrollTop: number) => void
    onDidScrollChange?: (e: monaco.IScrollEvent) => void
    onMount?: () => void
}

export const EditorPane = forwardRef<EditorPaneHandle, Props>(
    function EditorPane(
        { value, language, readOnly, decorations, showScrollbar, onDidScrollChange, onMount },
        ref
    ) {
        const containerRef = useRef<HTMLDivElement>(null)
        const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(
            null
        )
        const decorationCollectionRef =
            useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
        const onScrollRef = useRef(onDidScrollChange)
        useEffect(() => {
            onScrollRef.current = onDidScrollChange
        }, [onDidScrollChange])

        useImperativeHandle(ref, () => ({
            getEditor: () => editorRef.current,
        }))

        useEffect(() => {
            if (!containerRef.current) return
            const editor = monaco.editor.create(containerRef.current, {
                value,
                language,
                readOnly,
                theme: 'vs-dark',
                automaticLayout: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'off',
                lineNumbersMinChars: 0,
                lineDecorationsWidth: 0,
                glyphMargin: false,
                folding: false,
                renderLineHighlight: 'none',
                overviewRulerLanes: 0,
                scrollbar: {
                    vertical: showScrollbar ? 'visible' : 'hidden',
                    horizontal: 'hidden',
                    alwaysConsumeMouseWheel: false,
                },
            })
            editorRef.current = editor
            decorationCollectionRef.current =
                editor.createDecorationsCollection([])

            onMount?.()

            const scrollDisposable = editor.onDidScrollChange((e) =>
                onScrollRef.current?.(e)
            )

            return () => {
                scrollDisposable.dispose()
                editor.dispose()
            }
        }, []) // Mount once

        // Sync value changes
        useEffect(() => {
            const editor = editorRef.current
            if (!editor) return
            if (editor.getValue() !== value) {
                editor.setValue(value)
            }
        }, [value])

        // Sync language changes
        useEffect(() => {
            const editor = editorRef.current
            if (!editor) return
            const model = editor.getModel()
            if (model) monaco.editor.setModelLanguage(model, language)
        }, [language])

        // Sync readOnly changes
        useEffect(() => {
            editorRef.current?.updateOptions({ readOnly })
        }, [readOnly])

        // Sync decorations
        useEffect(() => {
            decorationCollectionRef.current?.set(decorations)
        }, [decorations])

        return (
            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%', overflow: 'hidden' }}
            />
        )
    }
)
