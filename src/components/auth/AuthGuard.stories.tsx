import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { expect, waitFor } from 'storybook/test';

import { Text } from '@mantine/core';

import { withMemoryRouter } from '../../../.storybook/tanstack-router-decorator';
import { AuthGuard } from './AuthGuard';

/**
 * Route-level auth gate. Redirects unauthenticated sessions to /login and
 * shows a spinner while the session resolves.
 *
 * Stories mock better-auth's `/api/auth/get-session` endpoint via MSW so
 * that swapping the dev `useSession()` (localStorage-backed, in
 * `src/lib/auth.ts`) for a real client in `src/lib/auth.ts` lights up the
 * pending / error / unauthenticated branches with no story edits.
 *
 * Note on the current dev client: `useSession()` always returns
 * `{ isPending: false, error: null }`, so the SessionPending and
 * SessionError stories render the same children as Default today. The MSW
 * handlers are wired so the stories reflect real-client behaviour once the
 * dev shim is replaced.
 */
const meta = {
  title: 'Shell/Auth/Auth Guard',
  component: AuthGuard,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [withMemoryRouter('/dashboard')],
} satisfies Meta<typeof AuthGuard>;

export default meta;
type Story = StoryObj<typeof AuthGuard>;

const sessionResponse = {
  user: { id: 'u1', name: 'Demo User', email: 'demo@rocketship.dev' },
  session: { id: 's1', userId: 'u1' },
};

/**
 * Canonical happy path. The guard has a session in localStorage (the dev
 * auto-login seeds one) and the children render untouched. MSW returns the
 * demo session so a real better-auth client would resolve identically.
 */
export const Default: Story = {
  beforeEach: ({ msw }) => {
    msw.use(http.get('/api/auth/get-session', () => HttpResponse.json(sessionResponse)));
  },
  render: () => (
    <AuthGuard>
      <Text component="p" size="sm" p={32}>Protected content — you are signed in.</Text>
    </AuthGuard>
  ),
};

/**
 * Backwards-compatible alias for the original "Authenticated" name. Kept so
 * any external link / docs reference still resolves to the canonical story.
 */
export const Authenticated: Story = {
  ...Default,
};

/**
 * Session is still resolving. With the current dev client (which always
 * reports `isPending: false`) this story renders identically to Default.
 * The never-resolving MSW handler is wired so swapping in a real client
 * surfaces the spinner branch.
 */
export const SessionPending: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get(
        '/api/auth/get-session',
        () => new Promise(() => undefined), // never resolves → spinner
      ),
    );
  },
  render: () => (
    <AuthGuard>
      <Text component="p" size="sm" p={32}>Never reached while pending.</Text>
    </AuthGuard>
  ),
};

/**
 * No session — the guard redirects to /login. We clear the dev
 * localStorage session in `beforeEach` so the redirect fires today (the
 * dev client reads from localStorage, not from the MSW handler); the MSW
 * 401 response is wired for the real-client path.
 */
export const Unauthenticated: Story = {
  beforeEach: ({ msw }) => {
    localStorage.removeItem('demo-session');
    msw.use(
      http.get('/api/auth/get-session', () =>
        HttpResponse.json({ user: null, session: null }),
      ),
    );
  },
  render: () => (
    <AuthGuard>
      <Text component="p" size="sm" p={32}>Protected content — you are signed in.</Text>
    </AuthGuard>
  ),
  play: async () => {
    // The guard's effect calls router.navigate({ to: '/login' }) and the
    // stub for /login is the "Stubbed page: /login" placeholder from
    // `withMemoryRouter`. Assert that placeholder renders.
    await waitFor(
      () => {
        expect(document.body.textContent).toContain('Stubbed page:');
        expect(document.body.textContent).toContain('/login');
      },
      { timeout: 3000 },
    );
  },
};

/**
 * Session endpoint returns 500. With the current dev client
 * (`useSession()` returns `error: null`) this renders identically to
 * Default. The MSW 500 is wired so a real client with an error branch
 * surfaces here.
 */
export const SessionError: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/auth/get-session', () =>
        HttpResponse.json({ message: 'Internal Server Error' }, { status: 500 }),
      ),
    );
  },
  render: () => (
    <AuthGuard>
      <Text component="p" size="sm" p={32}>Protected content — error branch not yet implemented.</Text>
    </AuthGuard>
  ),
};
