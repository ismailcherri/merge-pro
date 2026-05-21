import { describe, expect, it, vi } from 'vitest'

vi.mock('vscode', () => ({}))

import { gitStageUri } from '../../src/utils/gitUriUtils'

function makeUri(path: string) {
    return {
        fsPath: path,
        with: (overrides: Record<string, unknown>) => ({
            ...overrides,
            fsPath: path,
            original: { path },
        }),
    } as never
}

describe('gitStageUri', () => {
    it.each([1, 2, 3] as const)(
        'builds a git: URI with ref :%s and the file fsPath in the query',
        (stage) => {
            const uri = gitStageUri(makeUri('/repo/a.ts'), stage)
            expect(uri).toMatchObject({
                scheme: 'git',
                query: JSON.stringify({
                    path: '/repo/a.ts',
                    ref: `:${stage}`,
                }),
            })
        }
    )
})
