import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mantine/core';

import { hidden, textArg } from 'storybook/story-helpers';
import { MarkdownView } from './MarkdownView';

/**
 * Read-only markdown through kit's block editor. Chapters, project briefs and
 * saved tutor answers all render through it, so generated text looks exactly
 * like the notes you write.
 */
const meta = {
  title: 'Shell/Content/MarkdownView',
  component: MarkdownView,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <Box maw={720}>
        <Story />
      </Box>
    ),
  ],
  argTypes: {
    markdown: textArg('markdown', '', 'The markdown to render. Read once; key the component to change it.'),
    label: hidden(),
  },
} satisfies Meta<typeof MarkdownView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    markdown:
      '## Randomised timeouts\n\n> **Key idea:** random timeouts make split votes rare.\n\nEach follower picks a timeout between 150 and 300 ms.\n\n```go\ntimeout := 150*time.Millisecond\n```\n',
  },
};

export const ListsAndTodos: Story = {
  args: {
    markdown: '- [x] Elect a leader\n- [ ] Re-elect after failure\n\n1. Increment the term\n2. Vote for yourself\n',
  },
};

export const Empty: Story = {
  args: { markdown: '' },
};
