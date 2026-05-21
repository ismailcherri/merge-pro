import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['test/unit/webview/**/*.test.{ts,tsx}'],
        setupFiles: ['test/unit/webview/setup.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            reportsDirectory: 'coverage/webview',
            include: ['webview/**/*.{ts,tsx}'],
            exclude: [
                'webview/**/*.d.ts',
                'webview/editor/index.tsx',
                'webview/editor/setupMonacoWorkers.ts',
                'webview/panel/index.tsx',
                'webview/panel/vscode.ts',
                'test/**',
            ],
        },
        reporters: ['default', 'vitest-sonar-reporter'],
        outputFile: {
            'vitest-sonar-reporter': 'coverage/webview/test-report.xml',
        },
    },
})
