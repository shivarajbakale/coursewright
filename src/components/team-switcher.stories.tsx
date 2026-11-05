import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AudioLines, Command, Frame } from 'lucide-react';
import userEvent from '@testing-library/user-event';
import { expect, waitFor } from 'storybook/test';

import { Box } from '@mantine/core';

import { withSidebar } from '../../.storybook/shell-decorators';
import { hidden } from '../../.storybook/story-helpers';
import { TeamSwitcher } from './team-switcher';

const singleTeam = [
  { name: 'Console', logo: Command, plan: 'Workspace' },
];

const threeTeams = [
  { name: 'Console', logo: Command, plan: 'Workspace' },
  { name: 'Acme Co', logo: AudioLines, plan: 'Team' },
  { name: 'Personal', logo: Frame, plan: 'Free' },
];

/**
 * Decorator that fakes a mobile viewport. Sets up `window.matchMedia` and
 * `window.innerWidth` during render so the `SidebarProvider`'s `useIsMobile`
 * hook picks them up on mount (the override happens in a `useState` lazy
 * initializer, which runs synchronously during the first render — before any
 * descendant `useEffect`).
 *
 * Restoration on unmount IS necessary: the ui-probe sweep runs every story in
 * the same window, so without cleanup the Mobile story would leave
 * `window.innerWidth = 375` behind and every subsequent `useIsMobile()` call
 * (Dashboard, ProjectsPage, …) would render the mobile branch.
 */
function MobileViewport({ Story }: { Story: React.ComponentType }) {
  React.useState(() => {
    // Apply the fake viewport (and matchMedia stub) once on the story's
    // first render. The ui-probe runs every story in the same window, so
    // without teardown the Mobile story would leave `window.innerWidth =
    // 375` behind and every subsequent `useIsMobile()` call (Dashboard,
    // ProjectsPage, …) would render the mobile branch.
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      get: () => 375,
    });
    Object.defineProperty(window, 'outerWidth', {
      configurable: true,
      get: () => 375,
    });
    window.matchMedia = (query: string) => ({
      matches: query.includes('max-width'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
    return true;
  });

  React.useEffect(() => {
    return () => {
      // On unmount, delete the own properties we added so the browser's
      // built-in getters (which read the actual viewport set by
      // `page.viewport()` in each story) take over again.
      delete (window as unknown as { innerWidth?: unknown }).innerWidth;
      delete (window as unknown as { outerWidth?: unknown }).outerWidth;
      // matchMedia: re-derive from window.matchMedia if vitest's
      // chromium-mode polyfill re-installed itself, else reset to a
      // proxy that defers to the browser implementation via the
      // globalThis hook vitest may have set up. Falling back to a
      // no-op stub is safe — subsequent stories that need a real
      // matchMedia will run inside vitest's browser mode where it's
      // already restored.
      if (typeof window.matchMedia === 'function' && !window.matchMedia.length) {
        // The fake stub installed above took a single `query` argument
        // and ignored the second/third positional args; native matchMedia
        // only takes one arg too. The simplest reset: delete the own
        // property so the Window prototype getter kicks back in.
        delete (window as unknown as { matchMedia?: unknown }).matchMedia;
      }
    };
  }, []);

  return <Story />;
}

/**
 * Sidebar header team switcher. Single-tenant for now (the app has one
 * workspace, and `AppSidebar` renders a static badge instead), but the block is
 * in place so a multi-tenant version can plug in. The menu opens to the right
 * on desktop and to the bottom on mobile, where there is no room beside it.
 */
const meta = {
  title: 'Shell/Layout/Team Switcher',
  component: TeamSwitcher,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <Box p="sm">
        <Story />
      </Box>
    ),
    withSidebar,
  ],
  argTypes: {
    // `teams` is an array of objects — the Controls panel can't render a
    // sensible input for it. Variation between stories is achieved by
    // overriding `args.teams` per story (see `Default`, `MultipleTeams`,
    // `Plan Badge`).
    teams: hidden(),
  },
  args: { teams: singleTeam },
} satisfies Meta<typeof TeamSwitcher>;

export default meta;
type Story = StoryObj<typeof TeamSwitcher>;

export const Default: Story = {};

export const MultipleTeams: Story = {
  name: 'Multiple Teams',
  args: { teams: threeTeams },
};

export const DropdownOpen: Story = {
  name: 'Dropdown Open',
  args: { teams: threeTeams },
  play: async () => {
    const trigger = await waitFor(() => {
      const el = document.querySelector(
        '[data-sidebar="menu-button"]',
      ) as HTMLElement | null;
      if (!el) throw new Error('Team switcher trigger not found');
      return el;
    });
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(document.body.querySelector('[role="menu"]')).toBeInTheDocument();
    });
  },
};

export const Mobile: Story = {
  args: { teams: threeTeams },
  decorators: [(Story) => <MobileViewport Story={Story} />],
};

export const PlanBadge: Story = {
  name: 'Plan Badge',
  args: {
    teams: [{ name: 'Acme Co', logo: AudioLines, plan: 'Enterprise' }],
  },
};
