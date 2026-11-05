import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * The UI probe runs in real chromium, not jsdom.
 *
 * jsdom has no layout engine: every getBoundingClientRect is a zero rect, so
 * every measurement this probe exists to take would come back 0. Browser mode
 * gives real computed styles and real box geometry with no dev server to boot.
 *
 * Kept out of `vite.config.ts` on purpose — `npm test` stays a fast jsdom run,
 * and the pure rule unit tests under scripts/ui-probe/__tests__ run there.
 */
export default defineConfig({
  plugins: [react()],
  // Cold-cache determinism. Vite discovers `react-dom/client` only once the
  // probe's mount helper runs, then re-optimizes and reloads the page — which
  // kills the browser websocket mid-run ("Browser connection was closed while
  // running tests"). A warm `node_modules/.vite` hides this, so it only ever
  // bit a freshly scaffolded app on its very first `make check`. Pre-declaring
  // the entry points vite cannot see statically keeps the first run identical
  // to every later one.
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(import.meta.dirname, './src') },
      // Stories import shared showcase helpers as `storybook/story-helpers`.
      // `.storybook/main.ts` aliases that for the Storybook dev server; the
      // probe loads the same story files through this config, so it needs the
      // same mapping or every story fails to import.
      {
        find: 'storybook/story-helpers',
        replacement: path.resolve(import.meta.dirname, './.storybook/story-helpers.tsx'),
      },
    ],
  },
  test: {
    include: ['scripts/ui-probe/**/*.probe.tsx'],
    setupFiles: ['./scripts/ui-probe/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: true,
      screenshotFailures: false,
      instances: [{ browser: 'chromium' }],
    },
  },
});
