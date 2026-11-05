import type { Meta, StoryObj } from '@storybook/react-vite';
import { Rocket, Users } from 'lucide-react';

import { Box } from '@mantine/core';

import { boolArg, numberArg, textArg } from 'storybook/story-helpers';
import { StatCard } from './stat-card';

/** KPI tile for the dashboard. Tabular numerals; `delta` renders a signed trend. */
const meta = {
  title: 'Shell/Content/Stat Card',
  component: StatCard,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <Box w={260} p="md">
        <Story />
      </Box>
    ),
  ],
  argTypes: {
    label: textArg('label', 'Active projects', 'Caption above the value.'),
    value: textArg('value', '12', 'Big number. Use empty string to fall back to the skeleton.'),
    delta: numberArg('delta', {
      description: 'Signed trend percentage. Positive is up-right, negative is down-right.',
      defaultValue: 0,
    }),
    loading: boolArg('loading', 'Replace the value with a skeleton.', false),
  },
} satisfies Meta<typeof StatCard>;

export default meta;
type Story = StoryObj<typeof StatCard>;

export const Default: Story = {
  args: { label: 'Active projects', value: '12', icon: Rocket },
};

export const PositiveDelta: Story = {
  args: { label: 'Deploys this week', value: '47', delta: 12, icon: Rocket },
};

export const NegativeDelta: Story = {
  args: { label: 'Error rate', value: '2.4%', delta: -8, icon: Users },
};

export const Loading: Story = {
  args: { label: 'Team members', value: '', loading: true },
};

export const ZeroValue: Story = {
  name: 'Zero Value',
  args: { label: 'Empty state', value: '0', icon: Users },
};
