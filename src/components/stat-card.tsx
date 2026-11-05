import * as React from 'react';
import { Group, Paper, Progress, Skeleton, Text, type PaperProps } from '@mantine/core';
import { Sparkline } from '@mantine/charts';
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from 'lucide-react';

/** KPI tile used on the dashboard. Tabular numerals, optional trend delta,
 *  optional sparkline (an array of recent values the tile draws as a tiny
 *  line). Pass `series` to opt in to the sparkline; otherwise the tile stays
 *  a plain label/value/delta. */
export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  loading,
  series,
  progress,
  sub,
  ...props
}: PaperProps & {
  label: string;
  /**
   * The figure. A string for a static one; a node for a figure that should
   * count up to itself — `<AnimatedNumber>` is the intended one, and passing it
   * here rather than baking the animation into every tile is what keeps the
   * decision "which number deserves emphasis" with the page.
   */
  value: React.ReactNode;
  delta?: number;
  icon?: LucideIcon;
  loading?: boolean;
  /** Recent values — when provided (>=2 entries), draws a sparkline below the value. */
  series?: number[];
  /** Optional 0–1 progress bar shown below the value (e.g. seats used / total). */
  progress?: number;
  /** Optional caption rendered below the value (inside the card, above the
   *  sparkline / progress bar). */
  sub?: string;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Paper withBorder radius="md" p="md" {...props}>
      <Group justify="space-between" wrap="nowrap">
        {/* Lettered as a gauge is: capitals, tracked, the quiet grey. */}
        <Text
          size="0.625rem"
          fw={600}
          tt="uppercase"
          lts="0.1em"
          c="var(--app-faint)"
        >
          {label}
        </Text>
        {Icon && <Icon size={16} color="var(--mantine-color-dimmed)" />}
      </Group>
      <Group justify="space-between" align="flex-end" gap="xs" wrap="nowrap" mt={10}>
        {loading ? (
          <Skeleton height={32} width={64} />
        ) : (
          <Text
            size="1.5rem"
            fw={600}
            lh={1.2}
            ff="monospace"
            lts="-0.02em"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </Text>
        )}
        {!loading && delta !== undefined && (
          <Group gap={2} c={positive ? 'green' : 'red'}>
            {positive ? (
              <ArrowUpRight size={14} />
            ) : (
              <ArrowDownRight size={14} />
            )}
            <Text size="xs" fw={500} inherit>
              {Math.abs(delta)}%
            </Text>
          </Group>
        )}
      </Group>
      {/* `trendColors` reads the first and last point and picks the colour, so
          a falling KPI is red without the caller having to say so. */}
      {!loading && series && series.length > 1 && (
        <Sparkline
          h={24}
          mt={12}
          data={series}
          curveType="monotone"
          fillOpacity={0.12}
          strokeWidth={1.5}
          trendColors={{ positive: 'green', negative: 'red', neutral: 'gray' }}
        />
      )}
      {!loading && progress !== undefined && (
        <Progress value={Math.min(100, Math.max(0, progress * 100))} size="sm" mt="sm" />
      )}
      {!loading && sub && (
        <Text size="xs" c="dimmed" mt={6}>
          {sub}
        </Text>
      )}
    </Paper>
  );
}
