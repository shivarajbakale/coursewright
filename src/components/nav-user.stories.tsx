import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';

import {
  mswSession,
  withMemoryRouter,
} from '../../.storybook/tanstack-router-decorator';
import { withSidebar } from '../../.storybook/shell-decorators';
import { fixtureUsers, hidden, trigger } from '../../.storybook/story-helpers';
import { NavUser } from './nav-user';

/**
 * Sidebar footer user chip. Opens a menu with upgrade / account / settings /
 * billing / notifications / sign-out. Unlike `AccountMenu` (top-right chip,
 * pulls the user from `useSession()`), this component is a presentational
 * shell that takes the user as a prop — the sidebar supplies it.
 *
 * Avatar, name, email, and the truncation guards (long name, no image,
 * guest) are exercised below.
 */
const meta = {
  title: 'Shell/Layout/Nav User',
  component: NavUser,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  ...mswSession,
  decorators: [withMemoryRouter('/'), withSidebar],
  argTypes: {
    // `user` is an object — the Controls panel can't render a sensible
    // input for it, so we hide it. Variation between stories is achieved
    // by overriding `args.user` per story (see `Default`, `WithoutAvatar`,
    // `LongName`, `GuestUser`).
    user: hidden(),
  },
  args: { user: fixtureUsers.demo },
} satisfies Meta<typeof NavUser>;

export default meta;
type Story = StoryObj<typeof NavUser>;

/**
 * Canonical user — demo@rocketship.dev with a real avatar. The chip shows
 * the avatar (or initials fallback if the image fails), full name, full
 * email, and the trailing ⇅ chevron.
 */
export const Default: Story = {};

/**
 * Click the chip — the Radix dropdown opens, revealing the Upgrade to Pro /
 * Account / Billing / Notifications / Log out groups. Asserts the menu
 * items are present in the DOM after click.
 */
export const MenuOpen: Story = {
  name: 'Menu open',
  play: async () => {
    await userEvent.click(await trigger('[data-sidebar="menu-button"][data-size="lg"]'));
    await waitFor(() => {
      expect(document.body.textContent).toContain('Upgrade to Pro');
      expect(document.body.textContent).toContain('Log out');
      expect(document.body.textContent).toContain('Billing');
    });
  },
};

/**
 * Session shape with an empty `avatar`. `AvatarImage` falls back to
 * `AvatarFallback` (the initials), proving the chip still renders the
 * identity when the picture URL is missing — same path as a session that
 * has `image: null` after the avatar service returns 404.
 */
export const WithoutAvatar: Story = {
  name: 'Without avatar',
  args: { user: fixtureUsers.noAvatar },
};

/**
 * 50-character name — exercises the `truncate` on the chip's text spans.
 * The trailing `…` should kick in at the sidebar's expanded width; the
 * email column stays unchanged.
 */
export const LongName: Story = {
  name: 'Long name (truncated)',
  args: {
    user: {
      name: 'A'.repeat(50),
      email: 'long@example.com',
      avatar: fixtureUsers.demo.avatar,
    },
  },
};

/**
 * Guest — same shape the AppSidebar falls back to when `useSession()`
 * returns no data. Empty email, empty avatar, the fallback initials still
 * render.
 */
export const GuestUser: Story = {
  name: 'Guest user',
  args: { user: fixtureUsers.guest },
};
