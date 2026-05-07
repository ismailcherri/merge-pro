import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    plugins: [react()],
    // Use relative base so dynamic import() paths resolve via import.meta.url
    // instead of the webview frame origin (vscode-webview://), which would 403.
    base: './',
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
