import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { http, HttpResponse } from 'msw';

import App from '@/App';
import { ThemeProvider } from '@/components/theme-provider';
import { LoginPage } from '@/pages/Auth/LoginPage';
import { SignupPage } from '@/pages/Auth/SignupPage';
import { Dashboard } from '@/pages/Dashboard';
import { InboxPage } from '@/pages/InboxPage';
import { TeamPage } from '@/pages/TeamPage';
import { BillingPage } from '@/pages/BillingPage';
import { CustomersPage } from '@/pages/Customers/CustomersPage';
import { CustomerDetailPage } from '@/pages/Customers/CustomerDetailPage';
import { Settings } from '@/pages/Settings';

/**
 * The real shell, on a memory router.
 *
 * Mirrors `src/router/router.tsx` exactly — same components, same paths — but
 * builds a fresh router per mount so the probe can start at any path without a
 * singleton's history leaking between runs.
 */
/*
  Every routed page, and it has to stay that way.

  This list held four for a long time and the app shipped seven. Inbox, Team
  and Billing were routed, linked from the sidebar, and measured by nothing —
  which is how the Inbox filter row shipped with its counts clipped to slivers
  while every gate was green. A page that is not in this list is a page the
  harness has never looked at.

  `src/test/declarations.test.tsx` is the gate that keeps it honest — it names
  every path in `src/router/router.tsx` and fails on one this list does not
  carry. Added at the same time as Inbox, Team and Billing, because the drift
  had already happened once.
*/
export const PAGES = [
  { name: 'Dashboard', path: '/' },
  { name: 'Customers', path: '/customers' },
  { name: 'Inbox', path: '/inbox' },
  { name: 'Team', path: '/team' },
  { name: 'Billing', path: '/billing' },
  { name: 'Login', path: '/login' },
  { name: 'Signup', path: '/signup' },
  { name: 'Settings', path: '/settings' },
] as const;

/** AuthGuard blocks every protected route until a session resolves. */
export const sessionHandler = http.get('*/api/auth/get-session', () =>
  HttpResponse.json({
    user: { id: 'u1', name: 'Probe User', email: 'probe@rocketship.dev' },
    session: { id: 's1', userId: 'u1', activeOrganizationId: null },
  })
);

export function AppAt({ path }: { path: string }) {
  const queryClient = React.useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    []
  );

  const router = React.useMemo(() => {
    const rootRoute = createRootRoute({ component: App });
    const routeTree = rootRoute.addChildren([
      createRoute({ path: '/login', component: LoginPage, getParentRoute: () => rootRoute }),
      createRoute({ path: '/signup', component: SignupPage, getParentRoute: () => rootRoute }),
      createRoute({ path: '/', component: Dashboard, getParentRoute: () => rootRoute }),
      createRoute({ path: '/customers', component: CustomersPage, getParentRoute: () => rootRoute }),
      createRoute({
        path: '/customers/$customerId',
        component: CustomerDetailPage,
        getParentRoute: () => rootRoute,
      }),
      createRoute({ path: '/inbox', component: InboxPage, getParentRoute: () => rootRoute }),
      createRoute({ path: '/team', component: TeamPage, getParentRoute: () => rootRoute }),
      createRoute({ path: '/billing', component: BillingPage, getParentRoute: () => rootRoute }),
      createRoute({ path: '/settings', component: Settings, getParentRoute: () => rootRoute }),
    ]);
    return createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  }, [path]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Same position as `src/main.tsx`: inside the query client, around the
          router. ThemeProvider is MantineProvider, and every Mantine component
          — plus `useTheme()` in App itself — throws without it, so leaving it
          out here measured a crashed tree rather than the shell. */}
      <ThemeProvider defaultTheme="dark" storageKey="ui-probe-color-scheme">
        {/* The probe registers its own route tree, which the app's global Register
            interface does not know about. The cast keeps that local to this file. */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <RouterProvider router={router as any} />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

/** Settled means: a heading is on screen and no skeleton is still pulsing. */
export function pageReady(): boolean {
  return (
    document.querySelector('h1') !== null &&
    document.querySelectorAll('[data-slot="skeleton"]').length === 0
  );
}
