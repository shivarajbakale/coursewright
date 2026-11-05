import type { Meta, StoryObj } from '@storybook/react-vite';
import { Plus } from 'lucide-react';

import { Box, Button, List, Paper, Stack, Text, TextInput } from '@mantine/core';

import { textArg } from 'storybook/story-helpers';
import { PageShell } from './page-shell';

/**
 * The one page scaffold: title band + optional toolbar + scroll region. All
 * pages compose through this so headers stay pinned (fixed-viewport contract,
 * enforced by scripts/ui-lint.mjs).
 */
const meta = {
  title: 'Shell/Content/Page Shell',
  component: PageShell,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  decorators: [
    Story => (
      <Paper withBorder radius="md" data-panel={undefined} h={480} style={{ overflow: 'hidden' }}>
        <Story />
      </Paper>
    ),
  ],
  argTypes: {
    title: textArg('title', 'Projects'),
    description: textArg(
      'description',
      'Everything your team is shipping.',
      'Subtitle rendered under the page title.'
    ),
    actions: {
      control: { type: 'object' },
      description: 'Right-aligned slot in the title band (ReactNode).',
    },
    toolbar: {
      control: { type: 'object' },
      description: 'Secondary row beneath the title band (ReactNode).',
    },
  },
} satisfies Meta<typeof PageShell>;

export default meta;
type Story = StoryObj<typeof PageShell>;

export const Default: Story = {
  render: () => (
    <PageShell
      title="Projects"
      description="Everything your team is shipping."
      actions={
        <Button size="sm">
          <Plus /> New project
        </Button>
      }
    >
      <Text size="sm" c="dimmed">
        Page body scrolls inside the shell.
      </Text>
    </PageShell>
  ),
};

export const WithToolbar: Story = {
  render: () => (
    <PageShell
      title="Deployments"
      description="Production and preview environments."
      toolbar={
        <Text size="xs" c="dimmed">
          Filter chips go here
        </Text>
      }
    >
      <Text size="sm" c="dimmed">
        Body content.
      </Text>
    </PageShell>
  ),
};

export const WithoutActions: Story = {
  render: () => (
    <PageShell title="Notifications" description="Recent activity on your projects.">
      <List listStyleType="none" spacing="xs">
        <List.Item>
          <Text size="sm" component="span">
            Alice deployed v1.2.3 to production.
          </Text>
        </List.Item>
        <List.Item>
          <Text size="sm" component="span">
            Bob opened a new pull request.
          </Text>
        </List.Item>
        <List.Item>
          <Text size="sm" component="span">
            Carol commented on your issue.
          </Text>
        </List.Item>
      </List>
    </PageShell>
  ),
};

export const LongBody: Story = {
  render: () => (
    <PageShell
      title="Activity"
      description="The full timeline scrolls inside the shell — the title stays pinned."
      actions={
        <Button size="xs" variant="default">
          Export
        </Button>
      }
    >
      <Stack gap="sm">
        {Array.from({ length: 30 }).map((_, i) => (
          <Paper key={i} withBorder radius="md" p="sm">
            <Text size="sm" fw={500}>
              Event #{i + 1}
            </Text>
            <Text size="sm" c="dimmed">
              Some long-form description that adds visual weight to this card so the body overflows
              the visible region and the title band stays put.
            </Text>
          </Paper>
        ))}
      </Stack>
    </PageShell>
  ),
};

export const FormMode: Story = {
  name: 'Form Mode',
  render: () => (
    <PageShell
      title="Profile settings"
      description="Manage how others see you on the workspace."
      archetype="form"
    >
      <Box
        component="form"
        maw={448}
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
        }}
      >
        <Stack gap="md">
          {/* Mantine inputs carry their own label, so the label/control pair is
            one component rather than a wrapper div per field. */}
          <TextInput id="ps-name" label="Name" defaultValue="Demo User" />
          <TextInput id="ps-email" label="Email" type="email" defaultValue="demo@rocketship.dev" />
          <TextInput id="ps-bio" label="Bio" defaultValue="Scaffolding all the things." />
          {/*
          `data-submit` is how a form declares its primary action to the ui
          probe (rule B3). The shadcn Button published `data-variant="default"`
          and the rule accepted that as a stand-in; Mantine's Button publishes
          no variant attribute, so the intent has to be stated rather than
          inferred — which is the better contract anyway.
        */}
          <Button type="submit" size="xs" data-submit>
            Save changes
          </Button>
        </Stack>
      </Box>
    </PageShell>
  ),
};
