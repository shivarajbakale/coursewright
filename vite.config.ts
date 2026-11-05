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
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API requests to the backend
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        configure: (proxy: any, _options: any) => {
          proxy.on('error', (err: any, _req: any, _res: any) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (_proxyReq: any, req: any, _res: any) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes: any, req: any, _res: any) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
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
