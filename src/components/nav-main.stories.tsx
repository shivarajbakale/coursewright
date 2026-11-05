import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  CreditCard,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  Settings,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react';

import {
  mswSession,
  withMemoryRouter,
} from '../../.storybook/tanstack-router-decorator';
import { withSidebar } from '../../.storybook/shell-decorators';
import { NavMain } from './nav-main';
import { navItems } from '@/config/nav';

/** Sidebar icon shape consumed by `NavMain` — keeps each item's icon typed
 *  against the same `LucideIcon` the component expects. */
interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: { title: string; url: string }[];
}

/**
 * Primary sidebar navigation. Renders each entry as either a flat Link
 * (clickable top-level route) or a `<Collapsible>` accordion (when the
 * entry has children).
 *
 * Stories cover the four real shapes: a flat 5-item list from the nav
 * config, a list with collapsible groups, a single-entry highlight, and
 * edge cases (empty list, long list).
 */
const meta = {
  title: 'Shell/Layout/Nav Main',
  component: NavMain,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    items: {
      control: { type: 'object' },
      description:
        'Nav entries. An entry with `items` renders as a collapsible group; without, a flat Link.',
      table: { category: 'Data' },
    },
  },
  ...mswSession,
  decorators: [withMemoryRouter('/'), withSidebar],
} satisfies Meta<typeof NavMain>;

export default meta;
type Story = StoryObj<typeof NavMain>;

/**
 * The five flat items from `src/config/nav` — Dashboard / Projects /
 * Inbox / Team / Billing / Settings. No `isActive`, no sub-items; each
 * entry renders as a Link so a click actually navigates.
 */
export const Default: Story = {
  name: 'Default (5 flat items)',
  args: {
    items: navItems.map(({ title, to, icon }) => ({
      title,
      url: to,
      icon,
    })),
  },
};

/**
 * Mixed: three flat entries (Dashboard, Projects, Settings) plus two
 * collapsible groups (Workspaces and Reports) with their own sub-items.
 * Proves the accordion branch renders, the trigger chevron rotates on
 * open, and the sub-list stays visible after the click.
 */
export const WithCollapsibles: Story = {
  name: 'With collapsibles',
  args: {
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard },
      { title: 'Projects', url: '/projects', icon: FolderKanban },
      { title: 'Settings', url: '/settings', icon: Settings },
      {
        title: 'Workspaces',
        url: '/workspaces',
        icon: Users,
        items: [
          { title: 'Engineering', url: '/workspaces/eng' },
          { title: 'Design', url: '/workspaces/design' },
          { title: 'Operations', url: '/workspaces/ops' },
        ],
      },
      {
        title: 'Reports',
        url: '/reports',
        icon: Inbox,
        items: [
          { title: 'Weekly', url: '/reports/weekly' },
          { title: 'Monthly', url: '/reports/monthly' },
        ],
      },
    ] satisfies NavItem[],
  },
};

/**
 * Projects highlighted — `items[1].isActive = true` paints the active
 * background that `SidebarMenuButton` styles with
 * `data-[active=true]:bg-sidebar-accent`.
 */
export const ActiveItem: Story = {
  name: 'Active item (Projects)',
  args: {
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard },
      { title: 'Projects', url: '/projects', icon: FolderKanban, isActive: true },
      { title: 'Inbox', url: '/inbox', icon: Inbox },
      { title: 'Team', url: '/team', icon: Users },
      { title: 'Billing', url: '/billing', icon: CreditCard },
    ] satisfies NavItem[],
  },
};

/**
 * Empty list — proves the group renders gracefully without any items.
 * The "Platform" group label still appears; the menu `<ul>` is empty.
 */
export const Empty: Story = {
  name: 'Empty list',
  args: { items: [] },
};

/**
 * Twelve entries — exercises the scroll behaviour in the sidebar content
 * area (the kit's `SidebarContent` already has `overflow-auto`, but the
 * story is a visual smoke-test that nothing wraps or wraps ugly with this
 * many items).
 */
export const LongList: Story = {
  name: 'Long list (12 items)',
  args: {
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard },
      { title: 'Projects', url: '/projects', icon: FolderKanban },
      { title: 'Inbox', url: '/inbox', icon: Inbox },
      { title: 'Team', url: '/team', icon: Users },
      { title: 'Billing', url: '/billing', icon: CreditCard },
      { title: 'Settings', url: '/settings', icon: Settings },
      { title: 'Starred', url: '/starred', icon: Star },
      { title: 'Pinned', url: '/pinned', icon: Star },
      { title: 'Archive', url: '/archive', icon: Inbox },
      { title: 'Trash', url: '/trash', icon: Inbox },
      { title: 'Reports', url: '/reports', icon: Inbox },
      { title: 'Audit log', url: '/audit', icon: Inbox },
    ] satisfies NavItem[],
  },
};
