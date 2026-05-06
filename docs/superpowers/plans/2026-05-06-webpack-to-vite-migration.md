# Webpack to Vite Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace webpack with Vite for webview bundling while keeping the two-bundle output (panel + editor) and extension compilation unchanged.

**Architecture:** Single `vite.config.ts` with two rollup entry points (`webview/panel/index.tsx` and `webview/editor/index.tsx`) outputs `panel.js` and `editor.js` to `out/webview/`. `@vitejs/plugin-react` handles JSX (already installed). `vite-plugin-monaco-editor` replaces `monaco-editor-webpack-plugin` for Monaco's workers, CSS, and fonts.

**Tech Stack:** Vite, React, Monaco Editor, TypeScript

---

### Task 1: Install new dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install vite and vite-plugin-monaco-editor, remove webpack deps**

```bash
npm install --save-dev vite vite-plugin-monaco-editor
```

- [ ] **Step 2: Remove webpack-related dependencies**

```bash
npm uninstall --save-dev webpack webpack-cli ts-loader style-loader css-loader file-loader monaco-editor-webpack-plugin
```

- [ ] **Step 3: Verify package.json only has expected changes**

Check that `devDependencies` now includes `vite` and `vite-plugin-monaco-editor` and no longer includes the 6 removed packages.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: replace webpack deps with vite and vite-plugin-monaco-editor"
```

---

### Task 2: Create vite.config.ts

**Files:**
- Create: `vite.config.ts`

- [ ] **Step 1: Create the Vite config**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add vite.config.ts
git commit -m "feat: add vite config with panel and editor entry points"
```

---

### Task 3: Update package.json scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update the build, build:webview, and watch:webview scripts**

Change these three scripts in `package.json`:

Before:
```json
"build": "tsc -p tsconfig.json && webpack --config webpack.webview.config.js --mode production",
"build:webview": "webpack --config webpack.webview.config.js --mode development",
"watch:webview": "webpack --watch --config webpack.webview.config.js --mode development",
```

After:
```json
"build": "tsc -p tsconfig.json && vite build",
"build:webview": "vite build",
"watch:webview": "vite build --watch",
```

`build:ext`, `watch:ext`, and `vscode:prepublish` remain unchanged.

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: update build scripts to use vite"
```

---

### Task 4: Delete webpack config and update .vscodeignore

**Files:**
- Delete: `webpack.webview.config.js`
- Modify: `.vscodeignore`

- [ ] **Step 1: Delete the webpack config**

```bash
rm webpack.webview.config.js
```

- [ ] **Step 2: Update .vscodeignore**

Remove the line `webpack.webview.config.js`. The file no longer needs to reference it.

- [ ] **Step 3: Commit**

```bash
git add webpack.webview.config.js .vscodeignore
git commit -m "chore: remove webpack config, update .vscodeignore"
```

---

### Task 5: Build and verify output

- [ ] **Step 1: Clean previous build artifacts**

```bash
rm -rf out/webview
```

- [ ] **Step 2: Run the webview build**

```bash
npm run build:webview
```

Expected: Vite builds both `panel.js` and `editor.js` in `out/webview/`. No errors.

- [ ] **Step 3: Verify output files exist**

```bash
ls -la out/webview/panel.js out/webview/editor.js
```

Expected: Both files exist and are non-empty.

- [ ] **Step 4: Run full build**

```bash
npm run build
```

Expected: Extension compiles with tsc + webview bundles with vite. Both succeed.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: All tests pass (extension unit tests + webview unit tests).

- [ ] **Step 6: Commit (if any fixes were needed)**

Only if something needed adjustment. If everything passed clean, skip.

---

### Task 6: Final verification and commit

- [ ] **Step 1: Verify git status is clean**

```bash
git status
```

Expected: No uncommitted changes, no untracked files (except possibly `node_modules`).

- [ ] **Step 2: Verify final state**

Run a final check that the migration is complete:
- `webpack.webview.config.js` is gone
- `vite.config.ts` exists
- `package.json` scripts reference `vite`, not `webpack`
- `npm run build` succeeds
- `npm test` passes

- [ ] **Step 3: Commit any final cleanup**

```bash
git add -A
git commit -m "chore: finalize webpack to vite migration"
```
