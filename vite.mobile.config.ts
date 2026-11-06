import { defineConfig } from 'vite';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import base from './vite.config';

/**
 * The phone and iPad reader: React Native components rendered by react-native-web, served at /m/.
 * It shares the API client, services and types in src/ through the same `@` alias, and the dev
 * proxy of the main config, so it talks to the same agent service and tutor runtime.
 */
export default defineConfig({
  root: path.resolve(import.meta.dirname, 'mobile'),
  base: '/m/',
  // The shared public folder: the vendored Flowmovie player and the app icons, served under /m/.
  publicDir: path.resolve(import.meta.dirname, 'public'),
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@': path.resolve(import.meta.dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5174, proxy: base.server?.proxy },
  build: { outDir: path.resolve(import.meta.dirname, 'dist/m'), emptyOutDir: true },
});
