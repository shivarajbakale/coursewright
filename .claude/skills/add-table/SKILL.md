---
name: add-table
description: Build a sortable, filterable list using the DataTable composite (TanStack Table over Mantine's Table) wired to a query hook. Covers column definitions, the filter box, row selection and row actions, empty and loading states, and responsive column hiding. Use when the user asks to add a list page, a table, a "view X" page, or anything that renders a collection.
---

# add-table — sortable, filterable data with TanStack Table

`DataTable` (`src/components/data-table.tsx`) is the app's one table. TanStack
Table v8 stays headless and owns sorting, the global filter and row identity;
Mantine's `Table` draws it. Give it columns, data and a `getRowId`, and it
renders the whole thing — do not hand-roll the sort and filter wiring, and never
a raw `<table>` (`ui-lint` fails the build on one).

## Read these first

- `src/components/data-table.tsx` — read `DataTableProps`: `columns`, `data`,
  `getRowId`, `isLoading`, `onRowClick`, `selectedRowId`, `filter`,
  `filterPlaceholder`, `empty`.
- `src/pages/Customers/customer-columns.tsx` — the reference slice. Copy this file
  for a new resource and change only the accessors. Read its header comment: it
  records what the list deliberately does *not* draw.
- `src/pages/Customers/customer-columns.module.css` — the responsive column
  hiding. A media query is not something an inline style can express, so the
  widths and breakpoints live in a CSS module beside the columns.
- `src/pages/Customers/CustomersPage.tsx` — the table inside a `list` page: filter pinned above it, rows owning the one scroll region.
- `docs/principles/spacing-and-type.md` — table density follows Mantine's scale.
- `docs/principles/component-selection.md` — **Restraint inside a list**: why a
  row and a detail page want different drawings of the same record.

## The recipe

For a new list page (e.g. `/invoices`):

1. **Column definitions** — `src/pages/<Resource>/<resource>-columns.tsx`:

```tsx
import type { ColumnDef } from '@tanstack/react-table';
import { ActionIcon, Menu, Text } from '@mantine/core';
import { MoreHorizontal } from 'lucide-react';

import type { Invoice } from '@/api/types';
import cols from './invoice-columns.module.css';

export const invoiceColumns: ColumnDef<Invoice, unknown>[] = [
  {
    accessorKey: 'number',
    header: 'Number',
    cell: ({ row }) => (
      <Text size="sm" ff="monospace">
        {row.original.number}
      </Text>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => (
      <Text size="sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
          row.original.amount,
        )}
      </Text>
    ),
    meta: { headClassName: cols.amount, cellClassName: cols.amount },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    // Text, not a pill. One column in a list may carry colour; see "Restraint".
    cell: ({ row }) => <Text size="sm">{STATUS_LABELS[row.original.status]}</Text>,
    meta: { headClassName: cols.status, cellClassName: cols.status },
  },
  {
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: () => (
      <Menu position="bottom-end" width={160}>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" aria-label="Row actions">
            <MoreHorizontal size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item>View</Menu.Item>
          <Menu.Item>Edit</Menu.Item>
          <Menu.Divider />
          <Menu.Item color="red">Delete</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    ),
  },
];
```

2. **The page** — the query hook feeds the table, and the four states are the
   page's job:

```tsx
export function InvoicesPage() {
  const { data = [], isLoading, isError, error, refetch } = useInvoices();

  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <PageShell title="Invoices" description="All customer invoices." archetype="list" scroll={false}>
      <DataTable
        columns={invoiceColumns}
        data={data}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        filterPlaceholder="Filter invoices…"
        empty={
          <EmptyState
            title="No invoices yet"
            description="Invoices appear here when customers are billed."
          />
        }
      />
    </PageShell>
  );
}
```

`isLoading` renders skeleton rows inside the table, so the header and the column
widths stay put while the data lands.

## Column patterns

| Pattern | How |
| --- | --- |
| Sortable header | the default — `DataTable` draws the sort control on any column TanStack says can sort |
| Not sortable | `enableSorting: false` (row actions, avatars) |
| Fixed / narrow column | `meta: { headClassName: cols.amount, cellClassName: cols.amount }` — a class from the sibling CSS module, layout only |
| Hide on small screens | the same class pair, where the module hides the column and a `@media (min-width: …)` gives it back |
| Numeric | `<Text style={{ fontVariantNumeric: 'tabular-nums' }}>` so digits line up between rows |
| Status | text, or a dot and a word — see **Restraint** below |
| Date | formatted, never a raw ISO string |
| Actions | last column, `id: 'actions'`, no `accessorKey` |

`meta` carries two class hooks, `headClassName` and `cellClassName`, which
`DataTable` puts on the header cell and every body cell. They exist for layout —
width and visibility — and nothing else. The classes come from a CSS module
beside the columns, because that is where a media query can live:

```css
/* invoice-columns.module.css — hidden until the viewport can afford it */
.status {
  display: none;
  width: 8rem;
}

@media (min-width: 32rem) {
  .status {
    display: table-cell;
  }
}
```

## Restraint — what a list does not draw

A list is read by scanning one column at a time. Every pill, progress bar,
avatar hue and second line is drawn once per row, while the fact it carries is
read once. So the default in a table is plain text, and the exceptions are
earned one at a time:

- **Colour belongs to one column.** Pick the column a reader must catch out of
  the corner of their eye — health, status, overdue — and let it be the only
  coloured thing. A second coloured column turns the first into noise. In the
  customers table that column is health, drawn as a 6px dot beside a word.
- **Rank with weight, not with fills.** `fw={500}` on the tier that matters and
  `c="dimmed"` on the one that does not says the same thing a row of filled
  pills says, without the paint.
- **A ratio is two numbers.** `221 / 240` with the denominator dimmed beats a
  progress bar in a list; keep the bar for the detail page, where one account's
  usage is the point rather than a column to scan.
- **Avatars take one neutral tone.** `color="gray"`, never `color="initials"` —
  a hashed hue per row reads as a second status column beside the real one.
- **Badges keep their case.** The theme turns Mantine's default uppercase off,
  so a status reads `Past due`, not `PAST DUE`.
- **Don't repeat what the row already says.** The owner's email under the
  owner's name is a second line on every row for a string the filter cannot
  even match, because the accessor returns the name.

The badge components stay — `PlanBadge`, `HealthBadge`, `StatusBadge` — for the
**detail** page, where there is one of each and a pill is the right shape.
`PlanLabel` and `HealthLabel` beside them are the same facts as text, for the
list. When you add a resource, write both and use the labels in the columns.

## Selection and row click

`onRowClick` plus `selectedRowId` is the `list-detail` pattern: the row paints
itself selected with Mantine's own tone and the detail pane reads the same id.
For multi-select, add a checkbox column using Mantine `Checkbox` bound to
TanStack's `row.getIsSelected()` / `row.toggleSelected()`.

## Don'ts

- **Don't hand-roll a table.** No `<table>`, and no `flex` + `gap` grid pretending
  to be one — `ui-lint`'s `raw-table` rule fails the build.
- **Don't style cells with utility classes.** This app has none — Mantine props
  and CSS modules are the whole vocabulary, and `ui-lint` fails the build on a
  layout utility. `meta` classNames are for width and visibility only.
- **Don't put a badge in more than one column.** See **Restraint**: a list that
  colours everything has told the reader nothing.
- **Don't sort strings with `localeCompare` without `{ numeric: true }`** —
  otherwise "Item 10" sorts before "Item 9".
- **Don't put the row-actions menu first.** It goes last, where the eye ends.
- **Don't filter by id.** Filter on what the user reads: number, name, email.

## Verify

1. Sort by every sortable column — the indicator flips and the rows reorder.
2. Type in the filter box — non-matching rows disappear; clearing restores them.
3. Tab through the table — focus moves through the interactive cells in order.
4. Open a row-actions menu — focus stays inside it until Esc.
5. Shrink the pane — the columns marked hidden drop out, the table still scrolls
   inside its own region rather than the page.
6. Toggle theme — the chrome swaps with the palette.

See `ux-prepass` for the mandatory UI gates.
