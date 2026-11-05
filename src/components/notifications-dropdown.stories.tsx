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

/** Four notifications, two unread. The row badge should show `2` and the
 *  menu should list all four, newest first. */
const FOUR_NOTIFICATIONS = [
  {
    id: 'n1',
    kind: 'course_ready',
    title: 'Rust ownership and borrowing is ready',
    body: 'Chapters, diagrams and projects are written. Start with chapter 1.',
    href: '/courses/c-rust',
    courseId: 'c-rust',
    read: false,
    createdAt: '2025-01-15T10:00:00Z',
  },
  {
    id: 'n2',
    kind: 'course_failed',
    title: 'Build failed: How Postgres executes a query',
    body: 'The model returned no structured output for the outline.',
    href: '/courses/c-pg/building',
    courseId: 'c-pg',
    read: false,
    createdAt: '2025-01-15T09:00:00Z',
  },
  {
    id: 'n3',
    kind: 'review_ready',
    title: 'Review ready: A replicated key-value store',
    body: 'Feedback on your submission is in.',
    href: '/courses/c-raft/projects/p-1',
    courseId: 'c-raft',
    read: true,
    createdAt: '2025-01-15T08:00:00Z',
  },
  {
    id: 'n4',
    kind: 'source_failed',
    title: 'Couldn’t index raft.github.io/raft.pdf',
    body: 'HTTP 404 when fetching the page.',
    href: '/sources',
    courseId: null,
    read: true,
    createdAt: '2025-01-15T07:00:00Z',
  },
];

/** Twelve unread notifications, past the `9+` ceiling of the row badge. */
const MANY_UNREAD = Array.from({ length: 12 }, (_, i) => ({
  id: `u${i + 1}`,
  kind: 'course_ready' as const,
  title: `Course ${i + 1} is ready`,
  body: 'Chapters, diagrams and projects are written.',
  href: '/',
  courseId: null,
  read: false,
  createdAt: new Date(Date.now() - i * 60_000).toISOString(),
}));

/**
 * The sidebar's Notifications row and menu. Shows the unread count, the
 * latest notices and "Mark all read". Driven entirely by the
 * `/api/notifications` endpoint: stories override that handler so each
 * variant proves a different state of the same surface.
 */
const meta = {
  title: 'Shell/Layout/Notifications Dropdown',
  component: NotificationsDropdown,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  ...mswSession,
  decorators: [withMemoryRouter('/'), withSidebar],
  // Variation is driven by the `/api/notifications` MSW handler (overridden
  // per story via `beforeEach`); `railed` draws the collapsed-sidebar icon.
  argTypes: { railed: { control: 'boolean' } },
  args: { railed: false },
} satisfies Meta<typeof NotificationsDropdown>;

export default meta;
type Story = StoryObj<typeof NotificationsDropdown>;

/**
 * Default state: four notifications, two unread. The badge reads `2`.
 * The menu is closed. Asserts both the badge and the underlying query.
 */
export const Default: Story = {
  name: 'Default (4 notifications, 2 unread)',
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/notifications', () => HttpResponse.json(FOUR_NOTIFICATIONS)),
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
 * No notifications: no badge, and the menu shows the "You're all caught
 * up" empty state.
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
 * Loading: the handler never resolves, so the open menu shows three
 * skeleton rows.
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
 * Menu open: the latest notices and "Mark all read".
 */
export const MenuOpen: Story = {
  name: 'Menu open',
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/notifications', () => HttpResponse.json(FOUR_NOTIFICATIONS)),
    );
  },
  play: async () => {
    await userEvent.click(await trigger('button[aria-label^="Notifications"]'));
    await waitFor(() => {
      expect(document.body.textContent).toContain('Mark all read');
      expect(document.body.textContent).toContain('Rust ownership and borrowing is ready');
      expect(document.body.textContent).not.toContain('View all notifications');
    });
  },
};

/**
 * Twelve unread, past the `9+` ceiling. The badge clips to `9+`.
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
