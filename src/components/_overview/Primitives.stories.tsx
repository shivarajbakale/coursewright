import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';

/**
 * The kit, rendered.
 *
 * One styling system, on purpose: **Mantine owns everything** — colour, type,
 * radius, elevation, focus, *and* layout. `Group`, `Stack`, `Flex`, `Grid` and
 * `SimpleGrid` arrange this page; `ui-lint` fails the build if a utility class
 * from a second framework appears in a screen.
 *
 * It is also the regression test for the theme. If `src/theme.ts` stops being
 * applied, or the palette stops resolving, this is the page where it shows
 * first — which is why the story sweep in `make ui-probe` mounts it in a real
 * browser rather than trusting the stylesheet to be right.
 */
const meta = {
  title: 'Overview/Primitives',
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta;

export default meta;
type Story = StoryObj;

export const Primitives: Story = {
  name: 'Mantine primitives',
  render: () => (
    <Stack gap="lg" p="lg">
      <Stack gap="xs">
        <Title order={2}>Mantine primitives</Title>
        <Text c="dimmed" size="sm">
          Filled, outline and subtle variants, an input with a focus ring, and the
          two toggles — all reading the palette from the theme in{' '}
          <Text span ff="monospace" size="sm">
            src/theme.ts
          </Text>
          .
        </Text>
      </Stack>

      <Group gap="sm">
        <Button>Primary</Button>
        <Button variant="light">Light</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="subtle">Subtle</Button>
        <Button variant="default">Default</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" maw={576}>
        <TextInput label="Workspace name" placeholder="Acme Inc." />
        <TextInput label="Slug" placeholder="acme" error="Already taken" />
      </SimpleGrid>

      <Group gap="lg">
        <Checkbox defaultChecked label="Send weekly digest" />
        <Switch defaultChecked label="Enable beta features" />
        <Badge>Active</Badge>
        <Badge color="gray" variant="light">
          Archived
        </Badge>
      </Group>
    </Stack>
  ),
};

export const Surfaces: Story = {
  name: 'Surfaces and elevation',
  render: () => (
    <Stack gap="lg" p="lg">
      <Stack gap="xs">
        <Title order={2}>Surfaces</Title>
        <Text c="dimmed" size="sm">
          A raised surface sits one step off the page background. Mantine paints
          Paper and Card with the page colour by default; the theme overrides
          both to{' '}
          <Text span ff="monospace" size="sm">
            --app-surface
          </Text>{' '}
          so the separation this starter was designed around survives.
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Paper withBorder p="md" radius="md">
          <Text fw={600}>Paper, bordered</Text>
          <Text c="dimmed" size="sm">
            Hairline border, no shadow. The default panel.
          </Text>
        </Paper>
        <Card withBorder padding="md" radius="md">
          <Text fw={600}>Card</Text>
          <Text c="dimmed" size="sm">
            Same surface, sectioned padding.
          </Text>
        </Card>
        <Paper withBorder p="md" radius="md" shadow="md">
          <Text fw={600}>Paper, raised</Text>
          <Text c="dimmed" size="sm">
            Shadow reserved for things that float.
          </Text>
        </Paper>
      </SimpleGrid>
    </Stack>
  ),
};

export const LayoutBoundary: Story = {
  name: 'Layout without a second framework',
  render: () => (
    <Stack gap="lg" p="lg">
      <Stack gap="xs">
        <Title order={2}>Layout is Mantine too</Title>
        <Text c="dimmed" size="sm">
          Nothing below carries a class. `SimpleGrid` owns the track sizing,
          `Group` owns the row, and the style props carry the rest — a page that
          needs a grid does not need a second styling system to get one.
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        {['Requests', 'Errors', 'p95 latency', 'Uptime'].map((label, i) => (
          <Paper key={label} withBorder p="md" radius="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              {label}
            </Text>
            <Text size="xl" fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {['128k', '31', '212ms', '99.98%'][i]}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>

      <Group gap="sm" wrap="wrap">
        <Button variant="light">Filter</Button>
        <Button variant="light">Group by</Button>
        <Group gap="xs" ml="auto">
          <Text size="sm" c="dimmed">
            Last 24h
          </Text>
          <Button size="xs">Refresh</Button>
        </Group>
      </Group>
    </Stack>
  ),
};
