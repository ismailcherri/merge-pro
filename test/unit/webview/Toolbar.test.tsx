import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from '../../../webview/editor/Toolbar'

function makeProps(overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) {
    return {
        fileName: 'a.ts',
        currentConflict: 1,
        totalConflicts: 3,
        canUndo: false,
        canRedo: false,
        onPrev: vi.fn(),
        onNext: vi.fn(),
        onJumpToCurrent: vi.fn(),
        onAutoResolve: vi.fn(),
        onMagicResolve: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onSave: vi.fn(),
        ...overrides,
    }
}

describe('Toolbar', () => {
    it('renders the file name and conflict counter', () => {
        render(<Toolbar {...makeProps()} />)
        expect(screen.getByText('a.ts')).toBeTruthy()
        expect(screen.getByText(/Conflict 1 \/ 3/)).toBeTruthy()
    })

    it('shows "No conflicts" when total is 0', () => {
        render(<Toolbar {...makeProps({ totalConflicts: 0 })} />)
        expect(screen.getByText(/no conflicts/i)).toBeTruthy()
    })

    it.each([
        ['Prev', 'onPrev'],
        ['Next', 'onNext'],
        ['Auto-Resolve', 'onAutoResolve'],
        ['Magic', 'onMagicResolve'],
        ['Save', 'onSave'],
    ] as const)('fires %s callback when clicked', (label, key) => {
        const cb = vi.fn()
        const props = makeProps({ [key]: cb })
        render(<Toolbar {...props} />)
        fireEvent.click(
            screen.getByRole('button', { name: new RegExp(label, 'i') })
        )
        expect(cb).toHaveBeenCalledTimes(1)
    })

    it('fires onJumpToCurrent when the counter button is clicked', () => {
        const onJumpToCurrent = vi.fn()
        render(<Toolbar {...makeProps({ onJumpToCurrent })} />)
        fireEvent.click(
            screen.getByRole('button', { name: /conflict 1 \/ 3/i })
        )
        expect(onJumpToCurrent).toHaveBeenCalled()
    })

    it('disables undo/redo when not allowed and enables them when allowed', () => {
        const { rerender } = render(<Toolbar {...makeProps()} />)
        const undo = screen.getByRole('button', { name: /undo/i })
        const redo = screen.getByRole('button', { name: /redo/i })
        expect((undo as HTMLButtonElement).disabled).toBe(true)
        expect((redo as HTMLButtonElement).disabled).toBe(true)

        rerender(<Toolbar {...makeProps({ canUndo: true, canRedo: true })} />)
        expect(
            (screen.getByRole('button', { name: /undo/i }) as HTMLButtonElement)
                .disabled
        ).toBe(false)
        expect(
            (screen.getByRole('button', { name: /redo/i }) as HTMLButtonElement)
                .disabled
        ).toBe(false)
    })
})
