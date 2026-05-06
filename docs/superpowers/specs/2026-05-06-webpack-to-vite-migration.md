# Webpack to Vite migration for webview bundling

## Context

The project is a VS Code extension with two compilation steps:

- **Extension host** (`src/`): compiled with `tsc`, stays as-is
- **Webview UI** (`webview/`): React + Monaco Editor, currently bundled with webpack, migrating to Vite

Testing already uses Vitest. Motivation: faster dev builds, simpler config, tooling consistency.

## Design

### New file: `vite.config.ts`

Single config, dual entry points, outputs to `out/webview/`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import monacoEditorPlugin from 'vite-plugin-monaco-editor'

export default defineConfig({
    plugins: [react(), monacoEditorPlugin({ languageWorkers: [] })],
    build: {
        outDir: 'out/webview',
        rollupOptions: {
            input: {
                panel: path.resolve(__dirname, 'webview/panel/index.tsx'),
                editor: path.resolve(__dirname, 'webview/editor/index.tsx'),
            },
            output: {
                entryFileNames: '[name].js',
            },
        },
    },
})
```

- `@vitejs/plugin-react` is already a devDep (used by vitest webview config)
- `vite-plugin-monaco-editor` replaces `monaco-editor-webpack-plugin`, uses the same `languageWorkers: []` setting

### Output

`out/webview/panel.js` and `out/webview/editor.js` — same paths the extension providers already load.

### Scripts

| Script          | Before                                                                                 | After                                |
| --------------- | -------------------------------------------------------------------------------------- | ------------------------------------ |
| `build`         | `tsc -p tsconfig.json && webpack --config webpack.webview.config.js --mode production` | `tsc -p tsconfig.json && vite build` |
| `build:webview` | `webpack --config webpack.webview.config.js --mode development`                        | `vite build`                         |
| `watch:webview` | `webpack --watch --config webpack.webview.config.js --mode development`                | `vite build --watch`                 |

### Dependencies

Removed: webpack, webpack-cli, ts-loader, style-loader, css-loader, file-loader, monaco-editor-webpack-plugin
Added: vite, vite-plugin-monaco-editor

### Deleted

- `webpack.webview.config.js`

### Updated

- `.vscodeignore` — remove `webpack.webview.config.js`
