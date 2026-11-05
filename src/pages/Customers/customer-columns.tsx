import type { ColumnDef } from '@tanstack/react-table';

import { Avatar, Box, Group, Text } from '@mantine/core';

import type { Customer } from '@/api/types';
import { formatMoneyWhole } from '@/lib/format';
import { HealthLabel } from '@/pages/Customers/HealthBadge';
import { PlanLabel, StatusBadge } from '@/pages/Customers/PlanBadge';
import cols from './customer-columns.module.css';

/**
 * Column definitions for the Customers list.
 *
 * Kept beside the page rather than inside `DataTable` so a new resource can copy
 * this file and change only the accessors — the table itself is generic.
 *
 * Three things are worth copying along with the shape. Every column uses
 * `accessorKey`, so the table's one filter box searches the account name, the
 * domain, the plan and the health without a per-column search UI. The secondary
 * columns hide below a width via `meta`, which carries the two class hooks
 * `DataTable` puts on the header cell and the body cell. The rules live in
 * `customer-columns.module.css` because a media query is not something an
 * inline style can express.
 *
 * The third is what this table does *not* draw. Plan and health are text here,
 * not pills, and seats are a fraction with no bar under it: a list is read by
 * scanning one column at a time, and every pill, bar and second line is drawn
 * once per row while the fact it carries is read once. The pills still exist —
 * `PlanBadge` and `HealthBadge` — on the detail page, where there is one of
 * each and a badge is the right shape. Colour in this table is reserved for
 * health, which is the only column that wants to be seen out of the corner of
 * an eye.
 *
 * A column that does hold a `Badge` is sized from the badge's widest label, not
 * from the header's. Mantine truncates a `Badge` that does not fit rather than
 * overflowing it, so an under-wide column does not look broken — it silently
 * ships `ENTE…` and `AT …`, which reads as a rendering bug to everyone except
 * the person who set the width.
 */
export const customerColumns: ColumnDef<Customer, unknown>[] = [
  {
    accessorKey: 'name',
    header: 'Account',
    cell: ({ row }) => (
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        {/* Initials, not a logo: a real product resolves the avatar from the
            account's domain, and a placeholder image would be the one invented
            thing on the page.

            One neutral tone, not `color="initials"`. A hashed colour per account
            paints a different hue on every row, and next to the health column it
            reads as a second status — a red avatar beside a green "Healthy" is a
            sentence the table never meant to write. */}
        <Avatar name={row.original.name} color="gray" size={32} radius="md" />
        <Box style={{ minWidth: 0 }}>
          <Group gap={6} wrap="nowrap">
            <Text size="sm" fw={500} truncate>
              {row.original.name}
            </Text>
            <StatusBadge status={row.original.status} style={{ flexShrink: 0 }} />
          </Group>
          <Text size="xs" c="dimmed" truncate>
            {row.original.domain}
          </Text>
        </Box>
      </Group>
    ),
  },
  {
    // `accessorFn`, not `accessorKey`: the value is nested, and going through
    // the accessor is what puts the owner's name into the table's one filter
    // box alongside the account and the domain.
    id: 'owner',
    accessorFn: row => row.owner.name,
    header: 'Owner',
    // The name alone. The email was a second line on every row for an address
    // nobody copies out of a list — it is on the record, one click away, and it
    // was never in the filter index (the accessor above returns the name).
    cell: ({ row }) => (
      <Text size="sm" truncate>
        {row.original.owner.name}
      </Text>
    ),
    meta: {
      headClassName: `${cols.col} ${cols.owner}`,
      cellClassName: `${cols.col} ${cols.owner}`,
    },
  },
  {
    accessorKey: 'plan',
    header: 'Plan',
    cell: ({ row }) => <PlanLabel plan={row.original.plan} />,
    meta: {
      // Hidden on a narrow container rather than squeezed: `Enterprise` does
      // not fit a 342px table, and a truncated tier reads as a rendering bug.
      headClassName: `${cols.col} ${cols.plan}`,
      cellClassName: `${cols.col} ${cols.plan}`,
    },
  },
  {
    accessorKey: 'mrrCents',
    header: 'MRR',
    cell: ({ row }) => (
      <Text size="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {row.original.mrrCents === 0 ? '—' : formatMoneyWhole(row.original.mrrCents)}
      </Text>
    ),
    meta: {
      headClassName: `${cols.col} ${cols.mrr}`,
      cellClassName: `${cols.col} ${cols.mrr}`,
    },
  },
  {
    accessorKey: 'seatsUsed',
    header: 'Seats',
    // A fraction, and no bar under it. The bar drew the same ratio the two
    // numbers already state, twenty-seven times; the detail page keeps it, where
    // one account's seat usage is the point rather than a column to scan.
    cell: ({ row }) => {
      const { seats, seatsUsed } = row.original;
      return (
        <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {seatsUsed}
          <Text span c="dimmed">
            {' / '}
            {seats}
          </Text>
        </Text>
      );
    },
    meta: {
      headClassName: `${cols.col} ${cols.seats}`,
      cellClassName: `${cols.col} ${cols.seats}`,
    },
  },
  {
    accessorKey: 'health',
    header: 'Health',
    cell: ({ row }) => <HealthLabel health={row.original.health} />,
    meta: {
      // Sized for `At risk` plus its dot — the longest health label, and the
      // one that must never wrap onto a second line.
      headClassName: `${cols.col} ${cols.health}`,
      cellClassName: `${cols.col} ${cols.health}`,
    },
  },
];
