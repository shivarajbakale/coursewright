import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ColumnDef } from '@tanstack/react-table';

import { Badge, Button, Checkbox, EmptyState, Group, Text } from '@mantine/core';

import { DataTable } from './data-table';
import { eventArgTypes } from 'storybook/story-helpers';

/**
 * DataTable — TanStack Table with column-header sorting, faceted filters,
 * row selection, and row actions. Use for any list where the user needs
 * to find one of many rows quickly. For a static, read-only table, Mantine's
 * own `Table` is enough — this composite is for the lists that need to be
 * searched and sorted.
 */
const meta = {
  title: 'Shell/Content/Data Table',
  component: DataTable,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  argTypes: {
    ...eventArgTypes(['onRowClick', 'onSortingChange', 'onGlobalFilterChange']),
  },
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj<typeof DataTable>;

type Project = {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'archived';
  owner: string;
  updated: string;
};

const SAMPLE: Project[] = [
  { id: '1', name: 'Acme Web', status: 'active', owner: 'Shiv B.', updated: '2 hours ago' },
  { id: '2', name: 'Beta Mobile', status: 'paused', owner: 'Ada L.', updated: 'yesterday' },
  { id: '3', name: 'Gamma API', status: 'active', owner: 'Marcus K.', updated: '3 days ago' },
  { id: '4', name: 'Delta ETL', status: 'archived', owner: 'Yui N.', updated: 'last week' },
  { id: '5', name: 'Epsilon Mobile', status: 'active', owner: 'Priya R.', updated: 'just now' },
];

/**
 * Enough rows for a pager to be honest. Five rows behind a "1 2 3" is a
 * control that says there is more to see when there is not.
 */
const MANY: Project[] = Array.from({ length: 23 }, (_, i) => {
  const base = SAMPLE[i % SAMPLE.length];
  return { ...base, id: `many-${i + 1}`, name: `${base.name} ${i + 1}` };
});

const COLUMNS: ColumnDef<Project>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onChange={e => table.toggleAllPageRowsSelected(e.currentTarget.checked)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onChange={e => row.toggleSelected(e.currentTarget.checked)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => <Text size="sm" fw={500}>{row.getValue<string>('name')}</Text>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const v = row.getValue('status') as Project['status'];
      const color = v === 'active' ? 'green' : v === 'paused' ? 'yellow' : 'gray';
      return (
        <Badge color={color} variant="light" size="sm">
          {v}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'owner',
    header: 'Owner',
  },
  {
    accessorKey: 'updated',
    header: 'Updated',
  },
  {
    id: 'actions',
    header: '',
    cell: () => (
      <Group justify="flex-end">
        <Button variant="subtle" size="compact-xs">
          Open
        </Button>
      </Group>
    ),
  },
];

export const Default: Story = {
  render: () => <DataTable columns={COLUMNS} data={SAMPLE} getRowId={row => row.id} />,
};

export const Filterable: Story = {
  name: 'With filter box',
  render: () => (
    <DataTable
      columns={COLUMNS}
      data={SAMPLE}
      getRowId={row => row.id}
      filterPlaceholder="Filter projects…"
    />
  ),
};

export const Paginated: Story = {
  name: 'With pagination',
  render: () => (
    <DataTable
      columns={COLUMNS}
      data={MANY}
      getRowId={row => row.id}
      pageSize={5}
      filterPlaceholder="Filter projects…"
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable
      columns={COLUMNS}
      data={[]}
      getRowId={(row: Project) => row.id}
      empty="No projects yet — create one to get started."
    />
  ),
};

export const CustomEmpty: Story = {
  name: 'Custom empty state',
  render: () => (
    <DataTable
      columns={COLUMNS}
      data={[]}
      getRowId={(row: Project) => row.id}
      empty={
        <EmptyState
          title="Nothing here yet."
          description="Projects you create will show up in this list."
        >
          <Button size="xs">Create your first project</Button>
        </EmptyState>
      }
    />
  ),
};
