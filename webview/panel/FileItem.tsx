import { useState } from 'react'
import type { WebviewFileState } from '../../src/protocol'

interface Props {
    file: WebviewFileState
    onResolve: (uri: string) => void
    isActive: boolean
}

export function FileItem({ file, onResolve, isActive }: Props) {
    const isResolved =
        file.resolvedChunks >= file.totalChunks && file.totalChunks > 0
    const pct =
        file.totalChunks === 0
            ? 0
            : (file.resolvedChunks / file.totalChunks) * 100

    const [hover, setHover] = useState(false)
    const [btnHover, setBtnHover] = useState(false)

    const open = () => {
        if (isActive) return
        onResolve(file.uri)
    }

    return (
        <div
            onClick={open}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: isActive ? 'default' : 'pointer',
                borderLeft: isActive
                    ? '2px solid var(--vscode-focusBorder)'
                    : '2px solid transparent',
                background: isActive
                    ? 'var(--vscode-list-activeSelectionBackground, rgba(0,122,204,0.18))'
                    : hover
                      ? 'var(--vscode-list-hoverBackground, rgba(255,255,255,0.04))'
                      : undefined,
                opacity: isResolved ? 0.85 : 1,
                position: 'relative',
            }}
        >
            <span
                style={{
                    fontSize: 13,
                    color: isResolved
                        ? 'var(--vscode-testing-iconPassed)'
                        : 'var(--vscode-problemsWarningIcon-foreground)',
                }}
            >
                {isResolved ? '✓' : '●'}
            </span>
            <span
                style={{
                    flex: 1,
                    fontSize: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: isResolved
                        ? 'var(--vscode-descriptionForeground)'
                        : 'var(--vscode-foreground)',
                    textDecoration: isResolved ? 'line-through' : undefined,
                    textDecorationColor: isResolved
                        ? 'var(--vscode-descriptionForeground)'
                        : undefined,
                }}
            >
                {file.fileName}
            </span>
            {!isResolved && (
                <span
                    title={`${file.totalChunks} conflict${file.totalChunks === 1 ? '' : 's'}`}
                    style={{
                        fontSize: 10,
                        background: 'var(--vscode-badge-background)',
                        color: 'var(--vscode-badge-foreground)',
                        borderRadius: 10,
                        padding: '1px 6px',
                        minWidth: 18,
                        textAlign: 'center',
                    }}
                >
                    {file.totalChunks}
                </span>
            )}
            {!isResolved && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        if (!isActive) onResolve(file.uri)
                    }}
                    onMouseEnter={() => setBtnHover(true)}
                    onMouseLeave={() => setBtnHover(false)}
                    disabled={isActive}
                    style={{
                        fontSize: 11,
                        fontWeight: 500,
                        padding: '3px 10px',
                        cursor: isActive ? 'default' : 'pointer',
                        background: isActive
                            ? 'var(--vscode-button-secondaryBackground, rgba(255,255,255,0.08))'
                            : btnHover
                              ? 'var(--vscode-button-hoverBackground)'
                              : 'var(--vscode-button-background)',
                        color: isActive
                            ? 'var(--vscode-button-secondaryForeground, var(--vscode-foreground))'
                            : 'var(--vscode-button-foreground)',
                        border: '1px solid transparent',
                        borderRadius: 3,
                        opacity: isActive ? 0.7 : 1,
                    }}
                >
                    {isActive ? 'Editing…' : 'Resolve'}
                </button>
            )}
            {isResolved && (
                <button
                    onClick={(e) => {
                        e.stopPropagation()
                        onResolve(file.uri)
                    }}
                    onMouseEnter={() => setBtnHover(true)}
                    onMouseLeave={() => setBtnHover(false)}
                    style={{
                        fontSize: 11,
                        padding: '3px 10px',
                        cursor: 'pointer',
                        background: btnHover
                            ? 'var(--vscode-toolbar-hoverBackground, rgba(255,255,255,0.08))'
                            : 'transparent',
                        color: 'var(--vscode-foreground)',
                        border: '1px solid var(--vscode-button-border, var(--vscode-contrastBorder, rgba(255,255,255,0.15)))',
                        borderRadius: 3,
                    }}
                >
                    Review
                </button>
            )}
            {!isResolved && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 12,
                        right: 12,
                        height: 2,
                        background: 'rgba(255,255,255,0.08)',
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            width: `${pct}%`,
                            background:
                                'var(--vscode-problemsWarningIcon-foreground)',
                        }}
                    />
                </div>
            )}
        </div>
    )
}
