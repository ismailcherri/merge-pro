import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['test/unit/**/*.test.ts'],
        exclude: ['test/unit/webview/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            reportsDirectory: 'coverage/node',
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'src/types.ts', 'test/**'],
        },
        reporters: ['default', 'vitest-sonar-reporter'],
        outputFile: {
            'vitest-sonar-reporter': 'coverage/node/test-report.xml',
        },
    },
})
