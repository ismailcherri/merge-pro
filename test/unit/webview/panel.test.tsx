import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SessionHeader } from '../../../webview/panel/SessionHeader';
import { FileList } from '../../../webview/panel/FileList';
import { FileItem } from '../../../webview/panel/FileItem';
import type { WebviewFileState } from '../../../webview/panel/types';

const file = (overrides: Partial<WebviewFileState> = {}): WebviewFileState => ({
  uri: 'file:///repo/foo.ts',
  fileName: 'foo.ts',
  totalChunks: 3,
  resolvedChunks: 0,
  ...overrides,
});

describe('SessionHeader', () => {
  it('shows resolved / total count', () => {
    render(<SessionHeader total={5} resolved={2} />);
    expect(screen.getByText(/2 \/ 5/)).toBeTruthy();
  });

  it('shows completion message when all resolved', () => {
    render(<SessionHeader total={3} resolved={3} />);
    expect(screen.getByText(/all resolved/i)).toBeTruthy();
  });
});

describe('FileItem', () => {
  it('renders file name and conflict count', () => {
    render(<FileItem file={file()} onResolve={vi.fn()} isActive={false} />);
    expect(screen.getByText('foo.ts')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('calls onResolve when Resolve button clicked', () => {
    const onResolve = vi.fn();
    render(<FileItem file={file()} onResolve={onResolve} isActive={false} />);
    fireEvent.click(screen.getByRole('button', { name: /resolve/i }));
    expect(onResolve).toHaveBeenCalledWith('file:///repo/foo.ts');
  });

  it('shows "Resolved" state when all chunks done', () => {
    render(<FileItem file={file({ totalChunks: 2, resolvedChunks: 2 })} onResolve={vi.fn()} isActive={false} />);
    expect(screen.getByText(/resolved/i)).toBeTruthy();
  });
});

describe('FileList', () => {
  it('groups files into CONFLICTS and RESOLVED sections', () => {
    const files = [
      file({ uri: 'a', fileName: 'a.ts', totalChunks: 2, resolvedChunks: 0 }),
      file({ uri: 'b', fileName: 'b.ts', totalChunks: 2, resolvedChunks: 2 }),
    ];
    render(<FileList files={files} onResolve={vi.fn()} activeUri={undefined} />);
    expect(screen.getByText(/conflicts/i)).toBeTruthy();
    expect(screen.getAllByText(/resolved/i).length).toBeGreaterThan(0);
  });
});
