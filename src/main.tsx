import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { HotkeysProvider } from '@tanstack/react-hotkeys';
import '@shivarajbakale/ui/styles.css';
import '@shivarajbakale/blocks/styles.css';
import '@shivarajbakale/grid/styles.css';
import router from './router/router';
import { ThemeProvider } from './components/theme-provider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { queryClient } from './lib/queryClient';

/**
 * Enable MSW (Mock Service Worker) in development.
 *
 * Mocks are ON by default in dev so `npm run dev` boots with realistic data
 * and no backend. To disable (e.g. to point at a real local API), set
 * `VITE_ENABLE_MOCKING=false` in `.env` or on the CLI.
 */
async function enableMocking() {
  if (!import.meta.env.DEV) return;
  if (import.meta.env.VITE_ENABLE_MOCKING === 'false') return;
  const { worker } = await import('./mocks/browser');
  return worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
}

/**
 * Provider Hierarchy:
 * 1. QueryClientProvider - Server state management with React Query
 * 2. ThemeProvider - MantineProvider plus the colour-scheme adapter
 * 3. HotkeysProvider - default options for every `useHotkey` in the tree
 * 4. RouterProvider - TanStack Router for type-safe routing
 *
 * `HotkeysProvider` is not what makes `useHotkey` work — registrations go to a
 * module-level `HotkeyManager` either way. It is the one place that sets the
 * defaults they all inherit, which is why it is mounted even though nothing
 * would throw without it.
 */
enableMocking().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="dark" storageKey="ui-color-scheme">
            <HotkeysProvider>
              <RouterProvider router={router} />
            </HotkeysProvider>
          </ThemeProvider>
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
});
