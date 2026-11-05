import * as React from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from '@tanstack/react-router';

import { ThemeProvider } from '@/components/theme-provider';

/**
 * Test harness for routed components.
 *
 * Mounts a component under a real TanStack Router with memory history and a
 * fresh QueryClient, so tests exercise navigation and data fetching the way the
 * app does. Retries are off — a failing request should fail the test now rather
 * than three seconds from now.
 *
 * `paths` are declared by the caller because a slice usually spans more than
 * one route — `/customers` and `/customers/$customerId` are two pages, and a
 * test mounts whichever one it is about at whichever entry it needs.
 */
export function renderRoutes(
  Component: React.FunctionComponent,
  { paths, initialEntries }: { paths: string[]; initialEntries: string[] }
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const routes = paths.map((path) =>
    createRoute({ path, component: Component, getParentRoute: () => rootRoute })
  );

  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries }),
  });

  const result = render(
    <QueryClientProvider client={queryClient}>
      {/* Mantine components read their palette from provider context, so a
          component mounted without it throws rather than merely looking wrong.
          The app's own ThemeProvider is used, not a bare MantineProvider, so
          the tree under test carries the same theme the app ships. */}
      <ThemeProvider defaultTheme="dark" storageKey="test-color-scheme">
        {/* The test tree registers its own routes, which the app's global route
            register does not know about — the cast keeps that local to here. */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <RouterProvider router={router as any} />
      </ThemeProvider>
    </QueryClientProvider>
  );

  return { ...result, router, queryClient };
}

/** A Customers page, mounted with both of the slice's routes registered. */
export function renderCustomers(Component: React.FunctionComponent, initialEntry = '/customers') {
  return renderRoutes(Component, {
    paths: ['/customers', '/customers/$customerId'],
    initialEntries: [initialEntry],
  });
}
