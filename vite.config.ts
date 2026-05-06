import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

export default defineConfig({
  plugins: [
    react(),
    monacoEditorPlugin({
      languageWorkers: [],
    }),
  ],
  build: {
    outDir: path.resolve(__dirname, 'out', 'webview'),
    rollupOptions: {
      input: {
        panel: path.resolve(__dirname, 'webview', 'panel', 'index.tsx'),
        editor: path.resolve(__dirname, 'webview', 'editor', 'index.tsx'),
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
});
