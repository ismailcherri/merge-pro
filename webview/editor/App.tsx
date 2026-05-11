import type { ReactNode } from 'react'
import { Component, useEffect, useState } from 'react'
import type {
    ConflictChunk,
    EditorToHost,
    HostToEditor,
    SideDecision,
} from '../../src/protocol'
import { ThreePaneEditor } from './ThreePaneEditor'

declare function acquireVsCodeApi(): { postMessage: (m: EditorToHost) => void }
const vscode = acquireVsCodeApi()

interface EditorState {
    oursText: string
    baseText: string
    theirsText: string
    chunks: ConflictChunk[]
    fileName: string
    uri: string
    canUndo: boolean
    canRedo: boolean
}

function detectLanguage(fileName: string): string {
    const ext = fileName.split('.').pop() ?? ''
    const map: Record<string, string> = {
        ts: 'typescript',
        tsx: 'typescript',
        js: 'javascript',
        jsx: 'javascript',
        json: 'json',
        md: 'markdown',
        py: 'python',
    }
    return map[ext] ?? 'plaintext'
}

export class ErrorBoundary extends Component<
    { children: ReactNode },
    { error: boolean }
> {
    state = { error: false }
    static getDerivedStateFromError() {
        return { error: true }
    }
    componentDidCatch(error: Error) {
        console.error('MergePro: editor load failure:', error)
    }
    render() {
        if (this.state.error) {
            return (
                <div style={{ padding: 20 }}>
                    <p>MergePro editor failed to load.</p>
                    <button
                        onClick={() => vscode.postMessage({ type: 'ready' })}
                    >
                        Retry
                    </button>
                </div>
            )
        }
        return this.props.children
    }
}

export function App() {
    const [editorState, setEditorState] = useState<EditorState | null>(null)

    useEffect(() => {
        const handler = (e: MessageEvent) => {
            const msg = e.data as HostToEditor
            if (msg.type === 'init') {
                setEditorState({
                    oursText: msg.oursText,
                    baseText: msg.baseText,
                    theirsText: msg.theirsText,
                    chunks: msg.chunks,
                    fileName: msg.fileName,
                    uri: msg.uri,
                    canUndo: msg.canUndo,
                    canRedo: msg.canRedo,
                })
            } else if (msg.type === 'chunkUpdate') {
                setEditorState((prev) =>
                    prev
                        ? {
                              ...prev,
                              chunks: msg.chunks,
                              canUndo: msg.canUndo,
                              canRedo: msg.canRedo,
                          }
                        : null
                )
            }
        }
        window.addEventListener('message', handler)
        vscode.postMessage({ type: 'ready' })
        return () => window.removeEventListener('message', handler)
    }, [])

    if (!editorState) {
        return (
            <div style={{ padding: 20, opacity: 0.6 }}>
                Loading merge editor...
            </div>
        )
    }

    const handleChunkDecision = (
        chunkIndex: number,
        side: 'ours' | 'theirs',
        decision: SideDecision
    ) => {
        vscode.postMessage({
            type: 'chunkDecision',
            chunkIndex,
            side,
            decision,
        })
    }

    const handleSave = (content: string) => {
        vscode.postMessage({ type: 'saveFile', uri: editorState.uri, content })
    }

    const handleAutoResolve = () => vscode.postMessage({ type: 'autoResolve' })
    const handleMagicResolve = () =>
        vscode.postMessage({ type: 'magicResolve' })
    const handleMagicResolveChunk = (chunkIndex: number) =>
        vscode.postMessage({ type: 'magicResolveChunk', chunkIndex })
    const handleUndo = () => vscode.postMessage({ type: 'undo' })
    const handleRedo = () => vscode.postMessage({ type: 'redo' })

    return (
        <ThreePaneEditor
            oursText={editorState.oursText}
            baseText={editorState.baseText}
            theirsText={editorState.theirsText}
            chunks={editorState.chunks}
            fileName={editorState.fileName}
            language={detectLanguage(editorState.fileName)}
            canUndo={editorState.canUndo}
            canRedo={editorState.canRedo}
            onChunkDecision={handleChunkDecision}
            onAutoResolve={handleAutoResolve}
            onMagicResolve={handleMagicResolve}
            onMagicResolveChunk={handleMagicResolveChunk}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onSave={handleSave}
        />
    )
}
