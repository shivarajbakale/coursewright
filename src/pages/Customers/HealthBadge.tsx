import { Badge, Box, Group, Text } from '@mantine/core';

import type { CustomerHealth } from '@/api/types';

/**
 * An account's health score, in two forms.
 *
 * `HealthBadge` is the pill, for the one place that shows one account — the
 * detail page. `HealthLabel` is a dot and a word, for the list.
 *
 * The dot carries the same colour the pill did, so nothing is lost: green,
 * amber and red still read down the column at a glance. What goes is the pill's
 * own chrome — a tinted ground, a border radius and uppercase type, repeated on
 * every row, which is a lot of drawing to say a word.
 *
 * This component owns one thing: the health → colour mapping. The pill itself
 * is Mantine's `Badge`, so padding, radius and type scale stay in one place —
 * a hand-rolled `<span>` drifts from the system the first time the system
 * changes, which is what `ui-lint`'s `hand-rolled-badge` rule exists to stop.
 *
 * `light` rather than `filled`: health is a label, not an action, and a column
 * of saturated pills reads as a column of buttons.
 */
const tones = {
  healthy: 'green',
  watch: 'yellow',
  at_risk: 'red',
} as const satisfies Record<CustomerHealth, string>;

const labels = {
  healthy: 'Healthy',
  watch: 'Watch',
  at_risk: 'At risk',
} as const satisfies Record<CustomerHealth, string>;

export function HealthBadge({ health }: { health: CustomerHealth }) {
  return (
    <Badge
      color={tones[health]}
      variant="light"
      tt="none"
      leftSection={<Box w={6} h={6} bg="currentColor" style={{ borderRadius: '50%' }} />}
    >
      {labels[health]}
    </Badge>
  );
}

/** The same colour, drawn as a dot beside plain text. */
export function HealthLabel({ health }: { health: CustomerHealth }) {
  return (
    <Group gap={8} wrap="nowrap">
      <Box
        w={6}
        h={6}
        bg={`var(--mantine-color-${tones[health]}-6)`}
        style={{ borderRadius: '50%', flexShrink: 0 }}
      />
      <Text size="sm">{labels[health]}</Text>
    </Group>
  );
}
