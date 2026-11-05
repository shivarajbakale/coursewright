import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Divider, Group, Stack, Text, Title } from '@mantine/core';

const SAMPLE = 'The quick brown fox jumps over the lazy dog 0123456789';

const SIZES = [
  { size: 'xs', label: 'Caption, table label, timestamp' },
  { size: 'sm', label: 'Body and every table cell' },
  { size: 'md', label: 'Default body' },
  { size: 'lg', label: 'Lead paragraph' },
  { size: 'xl', label: 'Large figure' },
] as const;

const HEADINGS = [
  { order: 1, label: 'Page title — one per screen' },
  { order: 2, label: 'Section heading' },
  { order: 3, label: 'Subsection' },
  { order: 4, label: 'Panel title' },
] as const;

const WEIGHTS = [
  { fw: 400, label: 'normal · body copy' },
  { fw: 500, label: 'medium · labels, table headers, nav' },
  { fw: 600, label: 'semibold · every heading' },
  { fw: 700, label: 'bold · emphasis inside a paragraph' },
] as const;

/**
 * Type scale — every text size and weight this app is allowed to use.
 *
 * The sizes are Mantine's, set in `src/theme.ts` (`fontSizes`, `headings`), and
 * a component spends them through a prop: `<Text size="sm">`, `<Title order={2}>`.
 * Never write a literal font-size in a component — the probe's hierarchy rules
 * (C1, C2) fail a view that invents one, because an invented size is a size no
 * other screen shares.
 */
const meta = {
  title: 'Overview/Typography',
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj;

function Row({ token, label, children }: { token: string; label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Group align="baseline" gap="lg" wrap="nowrap">
        <Text size="xs" c="dimmed" ff="monospace" w={110} style={{ flexShrink: 0 }}>
          {token}
        </Text>
        <Box style={{ minWidth: 0 }}>
          <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
            {label}
          </Text>
          {children}
        </Box>
      </Group>
      <Divider mt="md" />
    </Box>
  );
}

export const Scale: Story = {
  name: 'Type scale',
  render: () => (
    <Stack gap="md" p="lg" maw={768} mx="auto">
      <Stack gap={4}>
        <Title order={1} size="h3">
          Type scale
        </Title>
        <Text size="sm" c="dimmed">
          Five body sizes and four heading orders. Anything outside them is a new
          size, and a new size is a decision the whole app pays for.
        </Text>
      </Stack>
      {HEADINGS.map(h => (
        <Row key={h.order} token={`order={${h.order}}`} label={h.label}>
          <Title order={h.order}>{SAMPLE}</Title>
        </Row>
      ))}
      {SIZES.map(s => (
        <Row key={s.size} token={`size="${s.size}"`} label={s.label}>
          <Text size={s.size}>{SAMPLE}</Text>
        </Row>
      ))}
    </Stack>
  ),
};

export const Numeric: Story = {
  name: 'Numeric and mono',
  render: () => (
    <Stack gap="lg" p="lg" maw={768} mx="auto">
      <Stack gap={4}>
        <Title order={2} size="h4">
          Numeric and mono
        </Title>
        <Text size="sm" c="dimmed">
          Identifiers and versions take{' '}
          <Text span ff="monospace" size="sm">
            ff="monospace"
          </Text>
          . Any figure that stacks in a column takes{' '}
          <Text span ff="monospace" size="sm">
            fontVariantNumeric: 'tabular-nums'
          </Text>{' '}
          so the digits line up between rows.
        </Text>
      </Stack>
      <Group gap="xl" align="flex-start">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
            Monospace
          </Text>
          <Text ff="monospace" size="lg">
            sku_9471 · v0.42.1
          </Text>
        </Stack>
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.06em' }}>
            Tabular
          </Text>
          <Text ff="monospace" size="lg" style={{ fontVariantNumeric: 'tabular-nums' }}>
            $ 1,234,567.89
          </Text>
        </Stack>
      </Group>
    </Stack>
  ),
};

export const Weights: Story = {
  name: 'Weight ladder',
  render: () => (
    <Stack gap="md" p="lg" maw={768} mx="auto">
      <Stack gap={4}>
        <Title order={2} size="h4">
          Weight ladder
        </Title>
        <Text size="sm" c="dimmed">
          Four weights, no more — a fifth reads as a different typeface rather
          than a different emphasis.
        </Text>
      </Stack>
      {WEIGHTS.map(w => (
        <Row key={w.fw} token={`fw={${w.fw}}`} label={w.label}>
          <Text size="lg" fw={w.fw}>
            {SAMPLE}
          </Text>
        </Row>
      ))}
    </Stack>
  ),
};
