import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Code, Group, Paper, Text } from '@mantine/core';

import { ThemeProvider, useTheme } from './theme-provider';

/**
 * App-wide dark/light context (dark-first design system). Not a visual
 * component — this story documents the contract: wrap once in main.tsx, flip
 * via `useTheme().setTheme`, tokens live in src/App.css.
 *
 * In Storybook every story already renders inside ThemeProvider; use the
 * theme toolbar to see it live.
 */
const meta = {
  title: 'Shell/Theme/Theme Provider',
  component: ThemeProvider,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ThemeProvider>;

export default meta;
type Story = StoryObj<typeof ThemeProvider>;

function CurrentTheme() {
  const { theme, setTheme } = useTheme();
  return (
    <Paper withBorder radius="md" p="md">
      <Group gap="sm">
        <Text size="sm">
          Active theme: <Code>{theme}</Code>
        </Text>
        <Button
          variant="default"
          size="xs"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          Toggle to {theme === 'dark' ? 'light' : 'dark'}
        </Button>
      </Group>
    </Paper>
  );
}

export const ReadAndToggle: Story = {
  render: () => (
    <ThemeProvider defaultTheme="dark" storageKey="storybook-theme-provider-demo">
      <CurrentTheme />
    </ThemeProvider>
  ),
};

export const SystemMode: Story = {
  render: () => (
    <ThemeProvider defaultTheme="system" storageKey="storybook-theme-provider-system">
      <CurrentTheme />
    </ThemeProvider>
  ),
};

export const LightExplicit: Story = {
  render: () => (
    <ThemeProvider defaultTheme="light" storageKey="storybook-theme-provider-light">
      <CurrentTheme />
    </ThemeProvider>
  ),
};
