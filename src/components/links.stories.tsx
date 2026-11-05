import type { Meta, StoryObj } from '@storybook/react-vite';
import { Group, Stack } from '@mantine/core';

import { withMemoryRouter } from '../../.storybook/tanstack-router-decorator';
import { AnchorLink, ButtonLink, CardLink, NavLinkLink } from './links';

/**
 * Mantine components as typed TanStack Router links (`createLink`). Use these
 * instead of `component={Link}`, which loses `to`/`params` checking.
 */
const meta = {
  title: 'Shell/Content/Links',
  component: AnchorLink,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {},
  decorators: [withMemoryRouter('/')],
} satisfies Meta<typeof AnchorLink>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <AnchorLink to="/">Back to the library</AnchorLink>,
};

export const Buttons: Story = {
  render: () => (
    <Group>
      <ButtonLink to="/new">New course</ButtonLink>
      <ButtonLink to="/notes" variant="default">
        Notes
      </ButtonLink>
    </Group>
  ),
};

export const CardsAndNav: Story = {
  render: () => (
    <Stack w={320}>
      <CardLink to="/sources" withBorder radius="lg" p="md">
        Sources
      </CardLink>
      <NavLinkLink to="/tutor" label="Tutor" description="Ask about your course" />
    </Stack>
  ),
};
