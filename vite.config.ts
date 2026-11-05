import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // No TanStack Router *generator* plugin here on purpose: `src/router/router.tsx`
  // is a hand-written code-based tree, so there is no routes directory to
  // generate from and the plugin throws on boot. See src/test/vite-config.test.ts.
  plugins: [react()],
  resolve: {
    alias: {
      // `import.meta.dirname`, not `__dirname`: Vite 8's native config loader
      // defines no CommonJS globals, and warns on every boot of every generated
      // app that it is about to become the default.
      '@': path.resolve(import.meta.dirname, './src'),
    },
    // kit is linked from ../kit with its own node_modules; one React and one
    // Mantine for the whole page, or hooks and context break across the boundary.
    dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks'],
  },
  server: {
    port: 5173,
    proxy: {
      // CopilotKit runtime (runtime-dev/server.ts). Listed first: the longer prefix must win.
      '/api/copilotkit': {
        target: process.env.VITE_RUNTIME_URL || 'http://localhost:4000',
        changeOrigin: true,
      },
      // The Python agent service (agent/, FastAPI on :8123).
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8123',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
});
