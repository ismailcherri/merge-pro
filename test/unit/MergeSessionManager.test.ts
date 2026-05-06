import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock vscode before importing anything that uses it
vi.mock('vscode', () => ({
  EventEmitter: class {
    _cb: unknown;
    event = (cb: unknown) => { this._cb = cb; };
    fire = (v: unknown) => { if (this._cb) (this._cb as (v: unknown) => void)(v); };
    dispose = vi.fn();
  },
  workspace: {
    fs: { readFile: vi.fn().mockResolvedValue(new Uint8Array()) },
    asRelativePath: (uri: { fsPath: string }) => uri.fsPath,
    onDidChangeTextDocument: vi.fn(() => ({ dispose: vi.fn() })),
  },
  Uri: { file: (p: string) => ({ fsPath: p, toString: () => p }) },
}));

import { MergeSessionManager } from '../../src/services/MergeSessionManager';

function makeGitService(changes: Array<{ fsPath: string }> = []) {
  const emitter = { fire: vi.fn(), event: vi.fn(), dispose: vi.fn() };
  return {
    onDidMergeStateChange: emitter.event,
    getMergeChanges: vi.fn(() =>
      changes.map((c) => ({ uri: { fsPath: c.fsPath, toString: () => c.fsPath }, fileName: c.fsPath })),
    ),
    getFileContents: vi.fn().mockResolvedValue(''),
    _emitter: emitter,
  };
}

describe('MergeSessionManager', () => {
  it('starts with an empty session', () => {
    const git = makeGitService();
    const mgr = new MergeSessionManager(git as never);
    expect(mgr.getSessionState().files).toHaveLength(0);
  });

  it('emits onDidSessionUpdate when refreshAll is called', async () => {
    const git = makeGitService([{ fsPath: '/repo/foo.ts' }]);
    const mgr = new MergeSessionManager(git as never);
    const spy = vi.fn();
    mgr.onDidSessionUpdate(spy);

    await mgr.refreshAll();

    expect(spy).toHaveBeenCalled();
  });

  it('tracks totalChunks per file after refresh', async () => {
    const git = makeGitService([{ fsPath: '/repo/foo.ts' }]);
    // getFileContents: stage 2 (ours), stage 1 (base), stage 3 (theirs)
    git.getFileContents
      .mockResolvedValueOnce('a\nb\nc')   // ours (stage 2)
      .mockResolvedValueOnce('a\nb\nc')   // base (stage 1)
      .mockResolvedValueOnce('a\nX\nc');  // theirs (stage 3) — 1 non-conflicting chunk

    const mgr = new MergeSessionManager(git as never);
    await mgr.refreshAll();

    const state = mgr.getSessionState();
    expect(state.files).toHaveLength(1);
    expect(state.files[0].totalChunks).toBe(1);
    expect(state.files[0].resolvedChunks).toBe(0);
  });

  it('resolveChunk marks a chunk as resolved', async () => {
    const git = makeGitService([{ fsPath: '/repo/foo.ts' }]);
    git.getFileContents
      .mockResolvedValueOnce('a\nb\nc')
      .mockResolvedValueOnce('a\nb\nc')
      .mockResolvedValueOnce('a\nX\nc');

    const mgr = new MergeSessionManager(git as never);
    await mgr.refreshAll();

    const uri = { fsPath: '/repo/foo.ts', toString: () => '/repo/foo.ts' } as never;
    mgr.resolveChunk(uri, 0, 'ours');

    const state = mgr.getSessionState();
    expect(state.files[0].resolvedChunks).toBe(1);
  });
});
