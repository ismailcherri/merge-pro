vi.mock('../../../webview/panel/vscode', () => ({
    default: { postMessage: vi.fn() },
}))

import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WebviewFileState } from '../../../src/protocol'
import { App } from '../../../webview/panel/App'
import { BatchActionsBar } from '../../../webview/panel/BatchActionsBar'
import { FileItem } from '../../../webview/panel/FileItem'
import { FileList } from '../../../webview/panel/FileList'
import { SessionHeader } from '../../../webview/panel/SessionHeader'
import vscode from '../../../webview/panel/vscode'

const file = (overrides: Partial<WebviewFileState> = {}): WebviewFileState => ({
    uri: 'file:///repo/foo.ts',
    fileName: 'foo.ts',
    totalChunks: 3,
    resolvedChunks: 0,
    ...overrides,
})

describe('SessionHeader', () => {
    it('shows resolved / total count', () => {
        render(<SessionHeader total={5} resolved={2} />)
        expect(screen.getByText(/2 \/ 5/)).toBeTruthy()
    })

    it('shows completion message when all resolved', () => {
        render(<SessionHeader total={3} resolved={3} />)
        expect(screen.getByText(/all resolved/i)).toBeTruthy()
    })
})

describe('FileItem', () => {
    it('renders file name and conflict count', () => {
        render(<FileItem file={file()} onResolve={vi.fn()} isActive={false} />)
        expect(screen.getByText('foo.ts')).toBeTruthy()
        expect(screen.getByText('3')).toBeTruthy()
    })

    it('calls onResolve when Resolve button clicked', () => {
        const onResolve = vi.fn()
        render(
            <FileItem file={file()} onResolve={onResolve} isActive={false} />
        )
        fireEvent.click(screen.getByRole('button', { name: /resolve/i }))
        expect(onResolve).toHaveBeenCalledWith('file:///repo/foo.ts')
    })

    it('shows "Resolved" state when all chunks done', () => {
        render(
            <FileItem
                file={file({ totalChunks: 2, resolvedChunks: 2 })}
                onResolve={vi.fn()}
                isActive={false}
            />
        )
        expect(screen.getByText(/resolved/i)).toBeTruthy()
    })
})

describe('FileList', () => {
    it('groups files into CONFLICTS and RESOLVED sections', () => {
        const files = [
            file({
                uri: 'a',
                fileName: 'a.ts',
                totalChunks: 2,
                resolvedChunks: 0,
            }),
            file({
                uri: 'b',
                fileName: 'b.ts',
                totalChunks: 2,
                resolvedChunks: 2,
            }),
        ]
        render(
            <FileList files={files} onResolve={vi.fn()} activeUri={undefined} />
        )
        expect(screen.getByText(/conflicts/i)).toBeTruthy()
        expect(screen.getAllByText(/resolved/i).length).toBeGreaterThan(0)
    })
})

describe('App', () => {
    it('updates file list when stateUpdate message arrives', async () => {
        render(<App />)
        const event = new MessageEvent('message', {
            data: {
                type: 'stateUpdate',
                state: {
                    files: [
                        file({
                            fileName: 'conflict.ts',
                            totalChunks: 2,
                            resolvedChunks: 0,
                        }),
                    ],
                },
            },
        })
        await act(async () => {
            window.dispatchEvent(event)
        })
        expect(screen.getByText('conflict.ts')).toBeTruthy()
    })

    it('posts openEditor message when Resolve clicked', async () => {
        render(<App />)
        const event = new MessageEvent('message', {
            data: {
                type: 'stateUpdate',
                state: {
                    files: [file({ uri: 'file:///a.ts', fileName: 'a.ts' })],
                },
            },
        })
        await act(async () => {
            window.dispatchEvent(event)
        })
        const btn = screen.getByRole('button', { name: /resolve/i })
        fireEvent.click(btn)
        expect(vscode.postMessage).toHaveBeenCalledWith({
            type: 'openEditor',
            uri: 'file:///a.ts',
        })
    })
})

describe('BatchActionsBar', () => {
    it('renders null when no activeUri', () => {
        const { container } = render(
            <BatchActionsBar
                activeUri={undefined}
                onBatchAccept={vi.fn()}
                onAutoResolve={vi.fn()}
            />
        )
        expect(container.firstChild).toBeNull()
    })

    it('calls onBatchAccept with ours when Accept All Ours clicked', () => {
        const onBatchAccept = vi.fn()
        render(
            <BatchActionsBar
                activeUri="file:///a.ts"
                onBatchAccept={onBatchAccept}
                onAutoResolve={vi.fn()}
            />
        )
        fireEvent.click(screen.getByText(/accept all ours/i))
        expect(onBatchAccept).toHaveBeenCalledWith('file:///a.ts', 'ours')
    })

    it('calls onBatchAccept with theirs when Accept All Theirs clicked', () => {
        const onBatchAccept = vi.fn()
        render(
            <BatchActionsBar
                activeUri="file:///a.ts"
                onBatchAccept={onBatchAccept}
                onAutoResolve={vi.fn()}
            />
        )
        fireEvent.click(screen.getByText(/accept all theirs/i))
        expect(onBatchAccept).toHaveBeenCalledWith('file:///a.ts', 'theirs')
    })
})
