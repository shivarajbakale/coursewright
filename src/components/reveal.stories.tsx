import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Paper, SimpleGrid, Stack, Text } from '@mantine/core';

import { Reveal, Stagger, StaggerItem } from './reveal';

/**
 * Entrance motion. `Reveal` brings one element in; `Stagger` + `StaggerItem`
 * bring a group in one after another.
 *
 * Every animated element in the app arrives through one of these, so the
 * choreography stays a single decision in `src/lib/motion.ts` rather than a
 * transition prop repeated in nineteen files. Each carries `data-motion`, which
 * is the handle the UI probe's Module M measures — M2 fails an element that
 * settles at anything less than full opacity, which is what an entrance that
 * never fired leaves behind.
 *
 * Under `prefers-reduced-motion: reduce` all three render their end state on
 * the first frame with no animation at all. Switch the setting in your OS and
 * reload to see it; probe rule M1 is the gate.
 */
const meta = {
  title: 'Shell/Motion/Reveal',
  component: Reveal,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    delay: {
      name: 'delay',
      description: 'Seconds to wait before entering. Use it to order two blocks.',
      control: { type: 'number' },
    },
  },
  decorators: [
    (Story) => (
      <Box w={520} p="md">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta<typeof Reveal>;

export default meta;
type Story = StoryObj<typeof Reveal>;

function Tile({ children }: { children: React.ReactNode }) {
  return (
    <Paper withBorder radius="md" p="md">
      <Text size="sm">{children}</Text>
    </Paper>
  );
}

/** One block, arriving. 300ms, ease-out, 8px of travel. */
export const Single: Story = {
  render: () => (
    <Reveal>
      <Tile>A panel settling into place.</Tile>
    </Reveal>
  ),
};

/** Two blocks in reading order — the second one waits out a `delay`. */
export const Ordered: Story = {
  render: () => (
    <Stack gap="md">
      <Reveal>
        <Tile>First — the thing the page is about.</Tile>
      </Reveal>
      <Reveal delay={0.12}>
        <Tile>Second — the supporting material.</Tile>
      </Reveal>
    </Stack>
  ),
};

/**
 * A group arriving in sequence.
 *
 * The 40ms step is deliberate: at the 100ms that reads well in a demo video, a
 * six-tile row takes 600ms to finish and the reader is on the first tile while
 * the last one is still moving.
 */
export const Staggered: Story = {
  render: () => (
    <Stagger>
      <SimpleGrid cols={2} spacing="md">
        {['Customers', 'Net new MRR', 'Churn', 'Seats'].map((label) => (
          <StaggerItem key={label}>
            <Tile>{label}</Tile>
          </StaggerItem>
        ))}
      </SimpleGrid>
    </Stagger>
  ),
};
