import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

export default defineConfig({
    plugins: [
        react(),
        monacoEditorPlugin({
            languageWorkers: ['json'],
        }),
    ],
    build: {
        outDir: path.resolve(__dirname, 'out', 'webview'),
        rollupOptions: {
            input: {
                panel: path.resolve(__dirname, 'webview', 'panel', 'index.tsx'),
                editor: path.resolve(
                    __dirname,
                    'webview',
                    'editor',
                    'index.tsx'
                ),
            },
            output: {
                entryFileNames: '[name].js',
                // ES module output with shared chunks for smaller bundles.
                // Webview HTML uses <script type="module"> to support this.
                chunkFileNames: 'assets/[name]-[hash].js',
            },
        },
    },
})
