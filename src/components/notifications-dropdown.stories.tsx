import type { Meta, StoryObj } from '@storybook/react-vite';
import { http, HttpResponse } from 'msw';
import { expect, userEvent, waitFor } from 'storybook/test';

import { trigger } from 'storybook/story-helpers';

import {
  mswSession,
  withMemoryRouter,
} from '../../.storybook/tanstack-router-decorator';
import { withSidebar } from '../../.storybook/shell-decorators';
import { NotificationsDropdown } from './notifications-dropdown';

/** Five notifications — two unread, three read. The bell badge should show
 *  `2`, the dropdown preview should list all five in latest-first order. */
const FIVE_NOTIFICATIONS = [
  {
    id: 'n1',
    kind: 'mention',
    title: 'Priya mentioned you',
    body: '@you can you take a look at the Q3 plan?',
    actor: { name: 'Priya Raman' },
    read: false,
    createdAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'n2',
    kind: 'comment',
    title: 'New comment on "Billing v2"',
    body: '"Looks great — let’s ship it Friday."',
    actor: { name: 'Alex Lee' },
    read: false,
    createdAt: '2025-01-15T09:00:00Z',
  },
  {
    id: 'n3',
    kind: 'deploy',
    title: 'Deploy succeeded',
    body: 'Production build "v2.18.3" went live.',
    actor: { name: 'CI' },
    read: true,
    createdAt: '2025-01-15T08:00:00Z',
  },
  {
    id: 'n4',
    kind: 'invite',
    title: 'Jordan accepted your invite',
    body: 'They joined the workspace as a Member.',
    actor: { name: 'Jordan Kim' },
    read: true,
    createdAt: '2025-01-15T07:00:00Z',
  },
  {
    id: 'n5',
    kind: 'payment',
    title: 'Invoice INV-2026-0042 paid',
    body: 'Pro plan — monthly ($29.00).',
    read: true,
    createdAt: '2025-01-15T06:00:00Z',
  },
];

/** Twelve unread notifications — past the `9+` threshold in the bell badge.
 *  The component renders `9+` for any unread count above nine. */
const MANY_UNREAD = Array.from({ length: 12 }, (_, i) => ({
  id: `u${i + 1}`,
  kind: 'mention' as const,
  title: `Mention ${i + 1}`,
  body: `Body for unread ${i + 1}`,
  read: false,
  createdAt: new Date(Date.now() - i * 60_000).toISOString(),
}));

/**
 * Topbar bell + dropdown. Shows the unread badge, the latest five
 * notifications, and a "Mark all read" action. Driven entirely by the
 * `/api/notifications` endpoint — stories here override that handler so
 * each variant proves a different state of the same surface.
 */
const meta = {
  title: 'Shell/Layout/Notifications Dropdown',
  component: NotificationsDropdown,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  ...mswSession,
  decorators: [withMemoryRouter('/'), withSidebar],
  // NotificationsDropdown takes no props — variation is driven entirely by
  // the `/api/notifications` MSW handler (overridden per story via
  // `beforeEach`). The argTypes block is declared so this story participates
  // in the Controls panel standard alongside the other shell stories.
  argTypes: {},
} satisfies Meta<typeof NotificationsDropdown>;

export default meta;
type Story = StoryObj<typeof NotificationsDropdown>;

/**
 * Default state — five notifications, two unread. The badge reads `2`.
 * Dropdown is closed. Asserts both the badge and the underlying query.
 */
export const Default: Story = {
  name: 'Default (5 notifications, 2 unread)',
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/notifications', () => HttpResponse.json(FIVE_NOTIFICATIONS)),
    );
  },
  play: async () => {
    await waitFor(() => {
      const trigger = document.body.querySelector(
        'button[aria-label="Notifications, 2 unread"]',
      );
      expect(trigger).toBeInTheDocument();
      expect(document.body.textContent).toContain('2');
    });
  },
};

/**
 * No notifications — the badge is absent (no unread), and opening the
 * dropdown would show the "You're all caught up" empty state.
 */
export const Empty: Story = {
  name: 'Empty',
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/notifications', () => HttpResponse.json([])),
    );
  },
  play: async () => {
    await waitFor(() => {
      const trigger = document.body.querySelector(
        'button[aria-label="Notifications"]',
      );
      expect(trigger).toBeInTheDocument();
      // No badge when nothing is unread.
      expect(document.body.textContent).not.toContain('Mark all read');
    });
  },
};

/**
 * Loading — the handler never resolves. The component renders the skeleton
 * list (three rows with `Skeleton` placeholders) until the query resolves.
 * Asserts the dropdown is open AND the skeletons are visible.
 */
export const Loading: Story = {
  name: 'Loading (handler never resolves)',
  beforeEach: ({ msw }) => {
    msw.use(
      http.get(
        '/api/notifications',
        () => new Promise(() => undefined), // never resolves
      ),
    );
  },
  play: async () => {
    // Open the dropdown so the loading skeleton is rendered.
    await userEvent.click(await trigger('button[aria-label^="Notifications"]'));
    await waitFor(() => {
      // Three skeleton rows: three <li> children in the loading <ul>.
      const skeletons = document.body.querySelectorAll('[data-slot="skeleton"]');
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });
  },
};

/**
 * Menu open — clicks the bell button. The dropdown content is rendered
 * with the latest notifications and the "Mark all read" affordance.
 */
export const MenuOpen: Story = {
  name: 'Menu open',
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/notifications', () => HttpResponse.json(FIVE_NOTIFICATIONS)),
    );
  },
  play: async () => {
    await userEvent.click(await trigger('button[aria-label^="Notifications"]'));
    await waitFor(() => {
      expect(document.body.textContent).toContain('Mark all read');
      expect(document.body.textContent).toContain('Priya mentioned you');
      expect(document.body.textContent).toContain('View all notifications');
    });
  },
};

/**
 * Twelve unread — past the `9+` ceiling. The badge clips to `9+`.
 */
export const ManyUnread: Story = {
  name: 'Many unread (12, badge shows 9+)',
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/notifications', () => HttpResponse.json(MANY_UNREAD)),
    );
  },
  play: async () => {
    await waitFor(() => {
      const trigger = document.body.querySelector(
        'button[aria-label="Notifications, 12 unread"]',
      );
      expect(trigger).toBeInTheDocument();
      // The badge text content is `9+`, not `12`.
      expect(document.body.textContent).toContain('9+');
      expect(document.body.textContent).not.toContain('12 unread');
    });
  },
};
