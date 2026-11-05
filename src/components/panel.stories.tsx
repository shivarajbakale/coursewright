import type { Meta, StoryObj } from '@storybook/react-vite';

import { Badge, Box, Button, Divider, Stack, Text } from '@mantine/core';

import { hidden, textArg, variantArg } from 'storybook/story-helpers';
import { Panel } from './panel';

/**
 * The section card that appears on nearly every page. Reach for `Panel` before
 * hand-rolling a `Card` with a header band — the header rule, the padding and
 * the danger tint are all decided here so they cannot drift page to page.
 */
const meta = {
  title: 'Shell/Content/Panel',
  component: Panel,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Box w={520} p="md">
        <Story />
      </Box>
    ),
  ],
  argTypes: {
    title: textArg('title', 'Notifications', 'Header heading. Omit for a header-less panel.'),
    description: textArg('description', '', 'Optional sub-line under the title.'),
    tone: variantArg('tone', ['default', 'muted', 'danger'], 'default'),
    actions: hidden(),
    children: hidden(),
    className: hidden(),
    contentProps: hidden(),
  },
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof Panel>;

export const Default: Story = {
  args: {
    title: 'Notifications',
    description: 'How this workspace reaches you.',
    children: (
      <Text size="sm" c="dimmed">
        Email digests are sent every weekday morning.
      </Text>
    ),
  },
};

export const WithActions: Story = {
  name: 'With Actions',
  args: {
    title: 'Inbox',
    description: '3 unread',
    actions: (
      <Button size="xs" variant="default">
        Mark all read
      </Button>
    ),
    children: (
      <Stack gap="xs">
        <span>Deploy finished — staging</span>
        <Divider />
        <span>Invite accepted — Priya</span>
      </Stack>
    ),
  },
};

export const HeaderLess: Story = {
  name: 'Header-less',
  args: {
    children: (
      <Text size="sm" c="dimmed">
        With no title, description or actions the header band is dropped entirely and the
        panel is a plain bordered surface.
      </Text>
    ),
  },
};

export const Danger: Story = {
  args: {
    title: 'Delete workspace',
    description: 'This cannot be undone.',
    tone: 'danger',
    actions: (
      <Button size="xs" color="red">
        Delete
      </Button>
    ),
    children: (
      <Text size="sm" c="dimmed">
        Every project, member and invoice in this workspace is removed permanently.
      </Text>
    ),
  },
};

export const Empty: Story = {
  args: {
    title: 'Integrations',
    actions: <Badge variant="light" color="gray">None</Badge>,
  },
};
