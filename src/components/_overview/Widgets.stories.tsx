import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button, Drawer, Group, Paper, PinInput, Stack, Text, Title } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { Carousel } from '@mantine/carousel';
import { AreaChart, Sparkline } from '@mantine/charts';

/**
 * The widgets that used to be third-party packages.
 *
 * Five surfaces here were separate dependencies with a hand-maintained wrapper
 * in `src/components/ui/`: the date picker (`react-day-picker`), the OTP field
 * (`input-otp`), the mobile drawer (`vaul`), the carousel (`embla` + 200 lines
 * of context) and the chart (a `recharts` re-theming layer). Each is now one
 * import from a Mantine package that reads the same theme as everything else,
 * so this page is where the swap is visible: no local wrapper, no second set
 * of tokens, no per-widget dark-mode handling.
 *
 * They live in one story file rather than five because they no longer belong to
 * us — there is nothing local left to document per widget. The Mantine docs are
 * the reference; this is the proof that they are wired to *this* theme.
 */
const meta = {
  title: 'Overview/Widgets',
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj;

const CHART_DATA = [
  { date: 'Mar 1', active: 12, paused: 3, archived: 1 },
  { date: 'Mar 8', active: 18, paused: 4, archived: 2 },
  { date: 'Mar 15', active: 15, paused: 2, archived: 4 },
  { date: 'Mar 22', active: 26, paused: 5, archived: 3 },
  { date: 'Mar 29', active: 31, paused: 3, archived: 5 },
];

const CHART_SERIES = [
  { name: 'archived', label: 'Archived', color: 'gray' },
  { name: 'paused', label: 'Paused', color: 'yellow' },
  { name: 'active', label: 'Active', color: 'brand' },
];

export const Inputs: Story = {
  name: 'Dates and codes',
  render: function Render() {
    const [date, setDate] = useState<string | null>('2026-03-15');
    const [code, setCode] = useState('');

    return (
      <Stack gap="lg" p="lg">
        <Stack gap="xs">
          <Title order={2}>Dates and codes</Title>
          <Text c="dimmed" size="sm">
            `DatePickerInput` from `@mantine/dates` and `PinInput` from
            `@mantine/core` — both are ordinary inputs, with the label, the
            description and the error slot the rest of the forms use.
          </Text>
        </Stack>

        <Group align="flex-start" gap="xl">
          <DatePickerInput
            w={260}
            label="Renews on"
            description="Billing anniversary"
            placeholder="Pick a date"
            value={date}
            onChange={setDate}
          />
          <Stack gap={6}>
            <Text size="sm" fw={500}>
              Verification code
            </Text>
            <PinInput length={6} oneTimeCode value={code} onChange={setCode} aria-label="Code" />
          </Stack>
        </Group>
      </Stack>
    );
  },
};

export const Overlays: Story = {
  name: 'Drawer',
  render: function Render() {
    const [opened, setOpened] = useState(false);

    return (
      <Stack gap="lg" p="lg">
        <Stack gap="xs">
          <Title order={2}>Drawer</Title>
          <Text c="dimmed" size="sm">
            The same overlay engine as `Modal`, so the focus trap, the scroll
            lock and the escape handling behave identically on both.
          </Text>
        </Stack>

        <Button onClick={() => setOpened(true)}>Open drawer</Button>
        <Drawer
          opened={opened}
          onClose={() => setOpened(false)}
          position="bottom"
          title="Filters"
        >
          <Text size="sm" c="dimmed">
            Drawer content. On a phone this is the pattern that replaces a modal.
          </Text>
        </Drawer>
      </Stack>
    );
  },
};

export const Data: Story = {
  name: 'Charts and carousel',
  render: () => (
    <Stack gap="lg" p="lg">
      <Stack gap="xs">
        <Title order={2}>Charts and carousel</Title>
        <Text c="dimmed" size="sm">
          Series colours are theme colour names (`brand`, `yellow`), not
          literals — the chart follows a palette change instead of drifting from
          it.
        </Text>
      </Stack>

      <AreaChart
        h={220}
        data={CHART_DATA}
        dataKey="date"
        type="stacked"
        curveType="monotone"
        withGradient
        withDots={false}
        series={CHART_SERIES}
        gridAxis="y"
        tickLine="none"
      />

      <Group gap="lg" align="center">
        <Sparkline
          w={160}
          h={40}
          data={[12, 18, 15, 26, 31]}
          curveType="monotone"
          fillOpacity={0.12}
          trendColors={{ positive: 'green', negative: 'red', neutral: 'gray' }}
        />
        <Text size="sm" c="dimmed">
          `Sparkline` picks its colour from the first and last value.
        </Text>
      </Group>

      <Carousel slideSize="50%" slideGap="md" withIndicators emblaOptions={{ loop: true }}>
        {['One', 'Two', 'Three', 'Four'].map((slide) => (
          <Carousel.Slide key={slide}>
            <Paper withBorder p="xl" radius="md">
              <Text fw={500}>Slide {slide}</Text>
            </Paper>
          </Carousel.Slide>
        ))}
      </Carousel>
    </Stack>
  ),
};
