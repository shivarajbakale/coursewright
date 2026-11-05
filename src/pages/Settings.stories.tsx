import type { Meta, StoryObj } from '@storybook/react-vite';

import { mswSession, withMemoryRouter } from '../../.storybook/tanstack-router-decorator';
import { Settings } from './Settings';

/**
 * Settings — sidebar-nav layout (Stripe-style) with Profile, Appearance,
 * Notifications, Integrations, and Danger zone sections. Each section is
 * independently selectable from the left rail.
 */
const meta = {
  title: 'Pages/Settings',
  component: Settings,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  ...mswSession,
  decorators: [withMemoryRouter('/settings')],
} satisfies Meta<typeof Settings>;

export default meta;
type Story = StoryObj<typeof Settings>;

export const Default: Story = {};

/** Authenticated user — all sections show their full UI. */
export const Authenticated: Story = {};

export const MobileRail: Story = {
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
};
