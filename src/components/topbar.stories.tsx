import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';

import { trigger } from 'storybook/story-helpers';

import {
  mswSession,
  withMemoryRouter,
} from '../../.storybook/tanstack-router-decorator';
import { withSidebar } from '../../.storybook/shell-decorators';
import { CommandPalette } from './command-palette';
import { Topbar } from './topbar';

/**
 * Sticky app topbar: sidebar trigger + page title + search/palette entry point
 * + notifications + account menu. Requires SidebarProvider (see Shell/App
 * Sidebar for the full shell).
 *
 * Page title comes from `pageTitleFor(pathname)` in `src/config/nav.ts`; the
 * title band updates as the router state moves. The interaction stories
 * below exercise the keyboard palette shortcut and the bell dropdown open
 * path.
 */
const meta = {
  title: 'Shell/Layout/Topbar',
  component: Topbar,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  ...mswSession,
  decorators: [withMemoryRouter('/'), withSidebar],
} satisfies Meta<typeof Topbar>;

export default meta;
type Story = StoryObj<typeof Topbar>;

/**
 * On `/` — title resolves to "Dashboard" via `pageTitleFor('/')`. The
 * search button shows the ⌘K hint, the bell sits in front of the theme
 * toggle, and the account menu is the trailing chip.
 */
export const Default: Story = {};

/**
 * On `/projects` — title swaps to "Projects". Nav highlight is owned by the
 * sidebar, not the topbar; the topbar only renders the resolved page name.
 */
export const OnProjectsPage: Story = {
  name: 'On Projects page',
  decorators: [withMemoryRouter('/projects')],
};

/**
 * On `/inbox` — title swaps to "Inbox". The same path the bell's "View all
 * notifications" link points at.
 */
export const OnInbox: Story = {
  name: 'On Inbox',
  decorators: [withMemoryRouter('/inbox')],
};

/**
 * Open the command palette via ⌘K. The palette listens on `metaKey+k` /
 * `ctrlKey+k` regardless of focus, so dispatching the keyboard event on
 * `document.body` is enough. Asserts the dialog role lands in the DOM.
 */
export const SearchFocused: Story = {
  name: '⌘K opens the command palette',
  // Topbar only renders the ⌘K *hint* — the listener lives in CommandPalette,
  // which App.tsx mounts as a sibling. Without it mounted here the shortcut
  // has nothing to open and the assertion below can never pass.
  decorators: [
    (Story) => (
      <>
        <Story />
        <CommandPalette />
      </>
    ),
  ],
  play: async () => {
    await userEvent.keyboard('{Meta>}k{/Meta}');
    await waitFor(() => {
      const dialog = document.body.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog as HTMLElement).toBeInTheDocument();
    });
  },
};

/**
 * Click the bell to open the notifications dropdown. Asserts the dropdown
 * label "Notifications" is visible — the bell badge count is exercised by
 * the NotificationsDropdown stories (and the AppShell `Authenticated`
 * composition).
 */
export const WithNotifications: Story = {
  name: 'Bell opens notifications dropdown',
  play: async () => {
    await userEvent.click(await trigger('button[aria-label^="Notifications"]'));
    await waitFor(() => {
      expect(document.body.textContent).toContain('Notifications');
      expect(document.body.textContent).toContain('Mark all read');
    });
  },
};
