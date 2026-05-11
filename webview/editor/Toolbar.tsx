import type { CSSProperties } from 'react'

interface Props {
    fileName: string
    currentConflict: number
    totalConflicts: number
    canUndo: boolean
    canRedo: boolean
    onPrev: () => void
    onNext: () => void
    onAutoResolve: () => void
    onMagicResolve: () => void
    onUndo: () => void
    onRedo: () => void
    onSave: () => void
}

const btn: CSSProperties = {
    fontSize: 11,
    padding: '3px 10px',
    cursor: 'pointer',
    borderRadius: 3,
    background: 'var(--vscode-button-secondaryBackground)',
    color: 'var(--vscode-button-secondaryForeground)',
    border: '1px solid var(--vscode-button-border, transparent)',
}

export function Toolbar({
    fileName,
    currentConflict,
    totalConflicts,
    canUndo,
    canRedo,
    onPrev,
    onNext,
    onAutoResolve,
    onMagicResolve,
    onUndo,
    onRedo,
    onSave,
}: Props) {
    const disabledBtn = (disabled: boolean): CSSProperties => ({
        ...btn,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
    })
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                background: 'rgba(0,0,0,0.2)',
                borderBottom: '1px solid var(--vscode-panel-border)',
                flexShrink: 0,
            }}
        >
            <div
                style={{
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 11,
                    opacity: 0.7,
                }}
            >
                {fileName}
            </div>
            <button style={btn} onClick={onPrev}>
                ▲ Prev
            </button>
            <span
                style={{
                    fontSize: 11,
                    color:
                        totalConflicts > 0
                            ? 'var(--vscode-problemsWarningIcon-foreground)'
                            : undefined,
                    minWidth: 70,
                    textAlign: 'center',
                }}
            >
                {totalConflicts === 0
                    ? 'No conflicts'
                    : `Conflict ${currentConflict} / ${totalConflicts}`}
            </span>
            <button style={btn} onClick={onNext}>
                Next ▼
            </button>
            <div
                style={{
                    width: 1,
                    height: 14,
                    background: 'rgba(255,255,255,0.15)',
                }}
            />
            <button
                style={disabledBtn(!canUndo)}
                onClick={onUndo}
                disabled={!canUndo}
                title="Undo (⌘Z / Ctrl+Z)"
            >
                ↶ Undo
            </button>
            <button
                style={disabledBtn(!canRedo)}
                onClick={onRedo}
                disabled={!canRedo}
                title="Redo (⇧⌘Z / Ctrl+Y)"
            >
                ↷ Redo
            </button>
            <button
                style={btn}
                onClick={onMagicResolve}
                title="Magic merge — auto-resolve conflicts whose changes are line-disjoint"
            >
                ✨ Magic
            </button>
            <button style={btn} onClick={onAutoResolve}>
                ✦ Auto-Resolve
            </button>
            <button
                style={{
                    ...btn,
                    background: 'var(--vscode-button-background)',
                    color: 'var(--vscode-button-foreground)',
                }}
                onClick={onSave}
            >
                ✓ Save
            </button>
        </div>
    )
}
