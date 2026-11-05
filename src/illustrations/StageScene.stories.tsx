import type { Meta, StoryObj } from '@storybook/react-vite';

import { Box, SimpleGrid, Stack, Text } from '@mantine/core';

import { hidden, numberArg, variantArg } from 'storybook/story-helpers';
import { StageScene, type SceneData, type SceneStage } from './index';

const STAGES: SceneStage[] = ['research', 'concepts', 'outline', 'chapters', 'projects', 'index'];

const RUST: SceneData = {
  topic: 'Rust Ownership, from first borrow to real CLI',
  terms: ['borrow', 'move semantics', '&mut T', 'lifetimes', 'Drop'],
  concepts: ['Ownership', 'Stack', 'Heap', 'Borrowing', 'Lifetimes', 'Drop', 'Rc'],
  modules: ['Moves and the stack', 'Borrowing', 'Lifetimes', 'Shared ownership'],
  chapters: [
    '1.1 What a value owns',
    '1.2 Moves',
    '2.1 References',
    '2.2 Mutable borrows',
    '2.3 Slices',
  ],
  chapterDone: 4,
  chapterTotal: 16,
  projects: ['File-dedupe CLI', 'Zero-copy log parser', 'Borrowing tokenizer'],
  chunks: 214,
};

const LONG: SceneData = {
  topic: 'Distributed systems for people who have only ever run a single Postgres box',
  terms: ['consensus protocols under partition', 'linearizability', 'vector clocks and causality'],
  concepts: [
    'Replication and failover',
    'Leader election protocols',
    'Quorums',
    'Clock skew and ordering',
  ],
  modules: ['Why one machine stops being enough', 'Replication, leaders and followers in depth'],
  chapters: [
    'An extremely long chapter title about the CAP theorem',
    'Raft, step by step with diagrams',
  ],
  chapterDone: 1,
  chapterTotal: 24,
  projects: ['A key-value store that survives a node being killed mid-write'],
  chunks: 1280,
};

/**
 * The animated illustration for each course-building stage on the Generating
 * screen. One SVG per stage, painted with the course's own words: topic terms,
 * concept names, module names, chapter titles with a done/total counter,
 * project names and the chunk count. Empty data falls back to placeholder
 * words; long labels are truncated. Motion stops under prefers-reduced-motion.
 */
const meta = {
  title: 'Illustrations/StageScene',
  component: StageScene,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  argTypes: {
    stage: variantArg('stage', STAGES, 'research'),
    height: numberArg('height', {
      min: 120,
      description: 'Fixed height in px; omit to scale with width.',
    }),
    data: hidden(),
  },
} satisfies Meta<typeof StageScene>;

export default meta;
type Story = StoryObj<typeof StageScene>;

export const Default: Story = {
  args: { stage: 'research', data: RUST },
  decorators: [
    Story => (
      <Box maw={880}>
        <Story />
      </Box>
    ),
  ],
};

function Gallery({ data }: { data: SceneData }) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      {STAGES.map(stage => (
        <Stack key={stage} gap={4}>
          <Text size="sm" c="dimmed">
            {stage}
          </Text>
          <StageScene stage={stage} data={data} />
        </Stack>
      ))}
    </SimpleGrid>
  );
}

export const AllStages: Story = {
  name: 'All stages',
  render: () => <Gallery data={RUST} />,
};

export const EmptyData: Story = {
  name: 'Empty data (placeholders)',
  render: () => <Gallery data={{}} />,
};

export const LongLabels: Story = {
  name: 'Long labels (truncated)',
  render: () => <Gallery data={LONG} />,
};
