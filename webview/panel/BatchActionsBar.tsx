import type { CSSProperties } from 'react'

interface Props {
    activeUri: string | undefined
    onBatchAccept: (uri: string, side: 'ours' | 'theirs') => void
    onAutoResolve: (uri: string) => void
}

export function BatchActionsBar({
    activeUri,
    onBatchAccept,
    onAutoResolve,
}: Readonly<Props>) {
    if (!activeUri) return null
    const btn: CSSProperties = {
        flex: 1,
        fontSize: 10,
        padding: '3px 6px',
        cursor: 'pointer',
        background: 'var(--vscode-button-secondaryBackground)',
        color: 'var(--vscode-button-secondaryForeground)',
        border: '1px solid var(--vscode-button-border, transparent)',
        borderRadius: 3,
    }
    return (
        <div
            style={{
                display: 'flex',
                gap: 4,
                padding: '5px 12px',
                borderBottom: '1px solid var(--vscode-panel-border)',
            }}
        >
            <button
                style={btn}
                onClick={() => onBatchAccept(activeUri, 'ours')}
            >
                Accept All Ours
            </button>
            <button
                style={btn}
                onClick={() => onBatchAccept(activeUri, 'theirs')}
            >
                Accept All Theirs
            </button>
            <button style={btn} onClick={() => onAutoResolve(activeUri)}>
                Auto-Resolve
            </button>
        </div>
    )
}
