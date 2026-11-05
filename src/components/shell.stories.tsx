import type { Meta, StoryObj } from '@storybook/react-vite';
import { Rocket } from 'lucide-react';
import { http, HttpResponse } from 'msw';
import { Plus } from 'lucide-react';

import { Button, Code, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { PageShell } from './page-shell';
import { StatCard } from './stat-card';
import { AuthGuard } from './auth/AuthGuard';
import { AuthLayout } from '../pages/Auth/AuthLayout';
import {
  mswSession,
  withMemoryRouter,
} from '../../.storybook/tanstack-router-decorator';
import { withAppShell } from '../../.storybook/shell-decorators';

/**
 * Composition stories for the full app shell. The individual chrome pieces
 * (AppSidebar, Topbar, CommandPalette, AuthGuard, AuthLayout) all have their
 * own stories — this file is what they look like glued together.
 */
const meta = {
  title: 'Shell/Composition/App Shell',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Authenticated: Story = {
  name: 'Authenticated',
  ...mswSession,
  decorators: [
    withAppShell({ initialPath: '/dashboard' }),
    withMemoryRouter('/dashboard'),
  ],
  render: () => (
    <PageShell
      title="Dashboard"
      description="Welcome back, Demo."
      actions={
        <Button size="sm">
          <Plus /> New project
        </Button>
      }
    >
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
        {[1, 2, 3, 4].map((i) => (
          <StatCard
            key={i}
            label={`Metric ${i}`}
            value={`${i * 12}`}
            icon={Rocket}
            delta={i * 3}
          />
        ))}
      </SimpleGrid>
    </PageShell>
  ),
};

export const Public: Story = {
  name: 'Public',
  decorators: [withMemoryRouter('/login')],
  render: () => (
    <AuthLayout>
      <Stack gap="md">
        <div>
          <Title order={1} size="h3">
            Sign in
          </Title>
          <Text size="sm" c="dimmed">
            Stubbed login form — see <Code>/login</Code> route in dev.
          </Text>
        </div>
        <Button fullWidth>Continue</Button>
      </Stack>
    </AuthLayout>
  ),
};

export const Error: Story = {
  name: 'Error',
  // AuthGuard currently reads from a local in-memory store, not MSW — so this
  // mock doesn't visibly affect today's render. The structure is in place for
  // when AuthGuard is rewired onto `/api/auth/get-session`; the story will
  // then exercise the 500 path and assert that no children leak through.
  decorators: [withMemoryRouter('/dashboard')],
  beforeEach: ({ msw }) => {
    msw.use(
      http.get(
        '/api/auth/get-session',
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
  },
  render: () => (
    <AuthGuard>
      <p>should not render</p>
    </AuthGuard>
  ),
};
