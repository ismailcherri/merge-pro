import type { CSSProperties } from 'react'
import type { WebviewFileState } from '../../src/protocol'
import { FileItem } from './FileItem'

interface Props {
    files: WebviewFileState[]
    onResolve: (uri: string) => void
    activeUri: string | undefined
}

export function FileList({ files, onResolve, activeUri }: Readonly<Props>) {
    const conflicts = files.filter((f) => f.resolvedChunks < f.totalChunks)
    const resolved = files.filter(
        (f) => f.resolvedChunks >= f.totalChunks && f.totalChunks > 0
    )

    const label: CSSProperties = {
        padding: '6px 12px 2px',
        fontSize: 10,
        opacity: 0.5,
        letterSpacing: '0.08em',
    }

    return (
        <div>
            {conflicts.length > 0 && (
                <>
                    <div style={label}>CONFLICTS ({conflicts.length})</div>
                    {conflicts.map((f) => (
                        <FileItem
                            key={f.uri}
                            file={f}
                            onResolve={onResolve}
                            isActive={f.uri === activeUri}
                        />
                    ))}
                </>
            )}
            {resolved.length > 0 && (
                <>
                    <div style={{ ...label, marginTop: 8 }}>
                        RESOLVED ({resolved.length})
                    </div>
                    {resolved.map((f) => (
                        <FileItem
                            key={f.uri}
                            file={f}
                            onResolve={onResolve}
                            isActive={false}
                        />
                    ))}
                </>
            )}
            {files.length === 0 && (
                <div
                    style={{
                        padding: 16,
                        opacity: 0.5,
                        fontSize: 12,
                        textAlign: 'center',
                    }}
                >
                    No merge conflicts detected.
                </div>
            )}
        </div>
    )
}
