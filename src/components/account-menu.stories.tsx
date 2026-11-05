import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { expect, userEvent, waitFor } from 'storybook/test';

import { trigger } from 'storybook/story-helpers';

import { mswSession, withMemoryRouter } from '../../.storybook/tanstack-router-decorator';
import { AccountMenu } from './account-menu';

/**
 * Topbar avatar dropdown: profile, settings and sign-out.
 *
 * The component pulls the user from `useSession()` (localStorage-backed
 * dev shim). MSW is wired so a real better-auth client lights up the
 * SignedOut variant with no story edits.
 */
const meta = {
  title: 'Shell/Overlays/Account Menu',
  component: AccountMenu,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  ...mswSession,
  decorators: [withMemoryRouter('/')],
} satisfies Meta<typeof AccountMenu>;

export default meta;
type Story = StoryObj<typeof AccountMenu>;

/**
 * Canonical closed state — the avatar button is mounted but the dropdown
 * is closed. Dev auto-login seeds the localStorage session so the avatar
 * shows the "Demo User" initials.
 */
export const Default: Story = {};

/**
 * Dropdown is open after clicking the avatar trigger. The Account /
 * Settings / Log out items are visible.
 */
export const MenuOpen: Story = {
  name: 'Menu open',
  play: async () => {
    await userEvent.click(await trigger('[aria-label="Account menu"]'));
    await waitFor(() => {
      expect(document.body.textContent).toContain('Log out');
      expect(document.body.textContent).toContain('Settings');
      expect(document.body.textContent).toContain('Account');
    });
  },
};

/**
 * No session. We clear the localStorage session so the dev client reports
 * `data: null` and the component falls back to the "User" / empty-email
 * placeholder. MSW is wired to mirror this for a real client.
 */
export const SignedOut: Story = {
  beforeEach: ({ msw }) => {
    localStorage.removeItem('demo-session');
    msw.use(
      http.get('/api/auth/get-session', () =>
        HttpResponse.json({ user: null, session: null }),
      ),
    );
  },
};

/**
 * Session is pending. The current dev client always reports
 * `isPending: false`, so this renders identically to Default today. The
 * never-resolving MSW handler is wired so a real client surfaces the
 * loading branch here.
 */
export const Loading: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get(
        '/api/auth/get-session',
        () => new Promise(() => undefined), // never resolves
      ),
    );
  },
};
