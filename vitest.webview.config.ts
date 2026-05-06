import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['test/unit/webview/**/*.test.tsx'],
    setupFiles: ['test/unit/webview/setup.ts'],
  },
});
