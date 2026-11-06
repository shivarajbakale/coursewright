import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import base from './vite.config';

const outDir = path.resolve(import.meta.dirname, 'dist/m');

type ViteManifest = Record<string, { file: string; css?: string[]; imports?: string[]; dynamicImports?: string[]; isEntry?: boolean }>;

/**
 * The files the reader needs offline: everything reachable from the page, except what only Mermaid
 * reaches. Mermaid is several MB in ~70 chunks and few chapters use it; it is cached the first time a
 * chapter with a Mermaid diagram is opened online (the 'cw-lazy' runtime cache below).
 */
function offlineFiles(): Set<string> {
  const manifest = JSON.parse(readFileSync(path.join(outDir, '.vite/manifest.json'), 'utf8')) as ViteManifest;
  const keep = new Set<string>();
  const seen = new Set<string>();
  const walk = (key: string) => {
    if (seen.has(key) || /mermaid/.test(key)) return;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) return;
    keep.add(chunk.file);
    chunk.css?.forEach((c) => keep.add(c));
    [...(chunk.imports ?? []), ...(chunk.dynamicImports ?? [])].forEach(walk);
  };
  Object.entries(manifest).forEach(([key, c]) => c.isEntry && walk(key));
  return keep;
}

/**
 * The phone and iPad reader: React Native components rendered by react-native-web, served at /m/.
 * It shares the API client, services and types in src/ through the same `@` alias, and the dev
 * proxy of the main config, so it talks to the same agent service and tutor runtime.
 *
 * It is also an installable app with a service worker scoped to /m/ (vite-plugin-pwa): the app and
 * its drawings are stored for offline use, API reads are network-first with the saved copy as the
 * fallback, and a new version waits for the reader to choose Reload (mobile/src/offline/).
 */
export default defineConfig({
  root: path.resolve(import.meta.dirname, 'mobile'),
  base: '/m/',
  // The shared public folder: the vendored Flowmovie player and the app icons, served under /m/.
  publicDir: path.resolve(import.meta.dirname, 'public'),
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifestFilename: 'manifest.webmanifest',
      manifest: {
        id: '/m/',
        name: 'Coursewright Reader',
        short_name: 'Coursewright',
        description: 'Read your Coursewright courses, online or off.',
        start_url: '/m/',
        scope: '/m/',
        display: 'standalone',
        theme_color: '#0B0D10',
        background_color: '#0B0D10',
        icons: [
          { src: '/m/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/m/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/m/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['index.html', 'assets/*.{js,css}', 'vendor/flowmovie/**/*.{js,css}', '*.{png,svg,ico}', 'app-switch.js'],
        globIgnores: ['mockServiceWorker.js', 'avatars/**', 'brand/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        manifestTransforms: [
          async (entries) => {
            const keep = offlineFiles();
            const manifest = entries.filter((e) => !e.url.startsWith('assets/') || keep.has(e.url));
            return { manifest, warnings: [] };
          },
        ],
        // app-switch.js is loaded from the site root by index.html; the worker controls the page, so it
        // serves it from the precache too.
        modifyURLPrefix: { 'app-switch.js': '/app-switch.js' },
        navigateFallback: '/m/index.html',
        navigateFallbackAllowlist: [/^\/m(\/|$)/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // The reading data: online, always the latest; on a bad or no connection, the saved copy.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && /^\/api\/(courses(\/[^/]+)?|chapters\/[^/]+)$/.test(url.pathname),
            handler: 'NetworkFirst',
            options: { cacheName: 'cw-api', networkTimeoutSeconds: 4, cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/m/assets/'),
            handler: 'CacheFirst',
            options: { cacheName: 'cw-lazy', expiration: { maxEntries: 200 } },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'cw-font-css' },
          },
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: { cacheName: 'cw-fonts', cacheableResponse: { statuses: [0, 200] }, expiration: { maxEntries: 60 } },
          },
        ],
      },
      devOptions: { enabled: process.env.VITE_PWA_DEV === '1', type: 'module', navigateFallback: 'index.html' },
    }),
  ],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@': path.resolve(import.meta.dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 5174, proxy: base.server?.proxy },
  build: { outDir, emptyOutDir: true, manifest: true },
});
