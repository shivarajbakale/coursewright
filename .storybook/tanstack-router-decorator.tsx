import React from 'react';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { http, HttpResponse } from 'msw';

import { Box, Code, Text } from '@mantine/core';

/**
 * Story decorator for components that touch TanStack Router and/or the auth
 * session (P4). Creates an in-memory router per render so `useNavigate`,
 * `useRouterState` and `Link` work without the real route tree.
 *
 * The fake session is served by MSW at better-auth's `/api/auth/get-session`.
 */
const sessionFixture = {
  user: { id: 'u1', name: 'Demo User', email: 'demo@rocketship.dev' },
  session: { id: 's1', userId: 'u1', activeOrganizationId: null },
};

export const authSessionHandler = http.get(
  '/api/auth/get-session',
  () => HttpResponse.json(sessionFixture)
);

// Paths the app shell links to. We stub each one by default so navigation
// warnings don't fire. If a story needs a real component on one of these
// paths, it supplies `routeMounts` — the only way to override the stub.
//
// `/` is in the list because pages like LoginPage call
// `router.navigate({ to: '/' })` in their effect when one already has a
// session in localStorage (the dev auto-login path). Without registering
// `/` the navigate lands on TanStack Router's 404 page.
const DEFAULT_STUB_PATHS = [
  '/',
  '/login',
  '/signup',
  '/dashboard',
  '/customers',
  '/customers/$customerId',
  '/settings',
  '/inbox',
  '/team',
  '/billing',
  '/help',
] as const;

function stubPage(path: string) {
  return function StubPage() {
    return (
      <Text p={32} size="sm" c="dimmed">
        Stubbed page: <Code>{path}</Code>
      </Text>
    );
  };
}

interface RouteMounts {
  /** Path → Component to render on that path. */
  [path: string]: React.ComponentType;
}

/**
 * Build a storybook decorator that mounts the story on `initialPath` inside
 * an in-memory TanStack Router.
 *
 * - The story component is mounted on `initialPath` (e.g.
 *   `withMemoryRouter('/login')` puts the story at `/login`). This is the
 *   fix vs. the previous version, which always mounted the story on `/`
 *   and stubbed every other path — meaning Settings/CustomersPage/LoginPage
 *   all rendered the "Stubbed page" placeholder instead of the real
 *   component.
 * - `routeMounts` lets a story put specific components on additional paths
 *   (useful for future stories that mount a whole multi-page tree). Anything
 *   not in `routeMounts` falls through to the default stub.
 * - The other paths the shell might navigate to are stubbed with a
 *   placeholder so `router.navigate` doesn't warn about an unknown path.
 */
export function withMemoryRouter(
  initialPath = '/',
  routeMounts: RouteMounts = {},
  /**
   * Where the router starts, when that is not the same string as the route.
   * A parameterised route is a *pattern* (`/customers/$customerId`) and a
   * location is a *value* (`/customers/demo-1`); mounting a detail story needs
   * both, and without this the story renders at a literal path whose params
   * are empty.
   */
  initialEntry = initialPath,
): (Story: React.ComponentType) => React.ReactElement {
  return function RouterDecorator(Story) {
    const rootRoute = createRootRoute({ component: () => <Outlet /> });

    // Build the set of paths the router knows about.
    const allPaths = new Set<string>([
      initialPath,
      ...Object.keys(routeMounts),
      ...DEFAULT_STUB_PATHS,
    ]);

    const children = [...allPaths].map((path) => {
      // The story gets its own route — exactly one of these per call.
      if (path === initialPath) {
        return createRoute({
          getParentRoute: () => rootRoute,
          path,
          component: () => <Story />,
        });
      }
      // Caller supplied a custom component for this path.
      if (routeMounts[path]) {
        const Comp = routeMounts[path];
        return createRoute({
          getParentRoute: () => rootRoute,
          path,
          component: () => <Comp />,
        });
      }
      // Default: stub.
      return createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: stubPage(path),
      });
    });

    const router = createRouter({
      routeTree: rootRoute.addChildren(children),
      history: createMemoryHistory({ initialEntries: [initialEntry] }),
      defaultPreload: 'intent',
    });

    return (
      /* A bordered box, deliberately not a `Paper`: the theme defaults every
         Paper to `data-panel="card"`, and a panel wrapped around the whole
         story becomes the top-level panel of every archetype inside it — the
         KPI tiles and the auth card then read as nested and the probe reports
         a dashboard with no KPI row and a centred view with no card. */
      <Box
        h={420}
        style={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
        }}
      >
        <RouterProvider router={router} />
      </Box>
    );
  };
}

export const mswSession = {
  // msw-storybook-addon v3 registers handlers through the story context.
  beforeEach: ({ msw }: any) => {
    msw.use(authSessionHandler);
  },
};