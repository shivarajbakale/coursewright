import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { axe } from 'vitest-axe';
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { LoginPage } from '@/pages/Auth/LoginPage';
import { ThemeProvider } from '@/components/theme-provider';

/**
 * Accessibility contract (ux-005).
 *
 * Every page must pass axe with zero violations. This is the machine-enforced
 * half of the UX rules in docs/UX.md: contrast, labels, focus order and ARIA
 * usage are caught here as failing tests, not in manual review. When this test
 * fails, axe names the offending node and rule — fix the component; do not
 * disable the rule or delete the test.
 *
 * Mounted under a standalone memory router (not the app shell) so the auth
 * guard cannot silently render an empty tree and make this pass vacuously.
 */
function renderAt(component: React.FunctionComponent, path: string) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const route = createRoute({
    getParentRoute: () => rootRoute,
    path,
    component,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([route]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(
    // ThemeProvider is MantineProvider: the page's inputs, buttons and alert
    // all come from Mantine and throw without it, so the axe run would be
    // measuring an error screen rather than the page.
    <ThemeProvider defaultTheme="dark" storageKey="a11y-test">
      {/* Local router instance — the cast keeps it independent of the app's
          global route register. */}
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <RouterProvider router={router as any} />
    </ThemeProvider>,
  );
}

describe('a11y contract', () => {
  it('LoginPage has no axe violations', async () => {
    const { container } = renderAt(LoginPage, '/login');
    // Router + auth state resolve asynchronously — wait for real content so
    // the axe run can never pass vacuously on an empty tree.
    await waitFor(() => expect(container.querySelector('input')).not.toBeNull());
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});
