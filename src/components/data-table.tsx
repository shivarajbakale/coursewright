import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  Box,
  Group,
  Pagination,
  ScrollArea,
  Skeleton,
  Stack,
  Table,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react';
import { motion } from 'motion/react';

import { durations, transitions, useMotionEnabled } from '@/lib/motion';
import styles from './data-table.module.css';

/**
 * The project's one data table: TanStack Table bound to Mantine's `Table`.
 *
 * TanStack stays headless and owns sorting, the global filter and row identity;
 * Mantine owns every pixel — the borders, the hover and selected row tones, the
 * sticky header. That split is why this composite survived the migration while
 * the kit around it did not: there is no Mantine data table, only a table, and
 * the sorting and filtering are ours.
 *
 * Build lists with this rather than a hand-written `<table>` — `ui-lint` fails
 * the build on the latter, and now that the kit is gone there is no exempt
 * directory left to write one in.
 */
export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Stable row identity — also drives which row reads as selected. */
  getRowId: (row: TData) => string;
  isLoading?: boolean;
  onRowClick?: (row: TData) => void;
  /**
   * Rows arrive in a short cascade rather than all at once.
   *
   * Opt-in, because it is only right for a table that is the subject of its
   * page. A table inside a settings panel or a dialog is supporting material,
   * and animating it draws the eye to the wrong thing.
   */
  staggerRows?: boolean;
  selectedRowId?: string | null;
  /** Placeholder for the filter box. Omit the box entirely with `filter={false}`. */
  filterPlaceholder?: string;
  filter?: boolean;
  /**
   * Rows per page. Omit and the table renders every row it is given.
   *
   * Paging is opt-in because it is a promise: a pager says "there is more
   * below the fold that scrolling will not reach", and a table of eight rows
   * that says that is lying. Turn it on where a list is long enough that the
   * reader needs a position they can come back to.
   */
  pageSize?: number;
  /** Rendered in place of the body when there are no rows. */
  empty?: React.ReactNode;
  className?: string;
}

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  isLoading,
  onRowClick,
  staggerRows = false,
  selectedRowId,
  filterPlaceholder = 'Filter…',
  filter = true,
  pageSize,
  empty,
  className,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = React.useState('');
  const paginated = typeof pageSize === 'number' && pageSize > 0;

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    getRowId: row => getRowId(row),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(paginated
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageIndex: 0, pageSize } },
        }
      : {}),
  });

  // Filtering shrinks the row set under a page index that was valid a keystroke
  // ago, and TanStack does not move it — the reader is left on page 4 of 2,
  // looking at an empty table with a pager that says otherwise.
  const filteredCount = table.getFilteredRowModel().rows.length;
  React.useEffect(() => {
    if (paginated && table.getState().pagination.pageIndex >= table.getPageCount()) {
      table.setPageIndex(0);
    }
  }, [paginated, filteredCount, table]);

  const rows = table.getRowModel().rows;
  const motionEnabled = useMotionEnabled();
  const showEmpty = !isLoading && rows.length === 0;
  const pageCount = paginated ? table.getPageCount() : 1;
  const { pageIndex } = table.getState().pagination;
  const firstOnPage = paginated ? pageIndex * (pageSize as number) + 1 : 1;
  const lastOnPage = paginated ? firstOnPage + rows.length - 1 : filteredCount;

  return (
    <Stack gap={0} className={className} style={{ minHeight: 0, flex: 1 }}>
      {filter && (
        <Box
          px="xs"
          py={6}
          style={{
            flexShrink: 0,
            borderBottom: '1px solid var(--mantine-color-default-border)',
          }}
        >
          <TextInput
            value={globalFilter}
            onChange={e => setGlobalFilter(e.currentTarget.value)}
            placeholder={filterPlaceholder}
            aria-label={filterPlaceholder}
            size="xs"
            variant="unstyled"
            leftSection={<Search size={14} />}
          />
        </Box>
      )}

      <ScrollArea style={{ minHeight: 0, flex: 1 }}>
        <Table
          stickyHeader
          highlightOnHover={!!onRowClick}
          verticalSpacing="xs"
          horizontalSpacing="md"
          striped={false}
        >
          <Table.Thead>
            {table.getHeaderGroups().map(headerGroup => (
              <Table.Tr key={headerGroup.id}>
                {headerGroup.headers.map(header => {
                  const sortable = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <Table.Th
                      key={header.id}
                      className={header.column.columnDef.meta?.headClassName}
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <UnstyledButton
                          component="button"
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          display="inline-flex"
                          style={{ alignItems: 'center', gap: 4 }}
                          fz="inherit"
                          fw="inherit"
                          c="inherit"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ArrowUp size={12} />
                          ) : sorted === 'desc' ? (
                            <ArrowDown size={12} />
                          ) : (
                            <ChevronsUpDown size={12} className={styles.sortHint} />
                          )}
                        </UnstyledButton>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </Table.Th>
                  );
                })}
              </Table.Tr>
            ))}
          </Table.Thead>

          <Table.Tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <Table.Tr key={`skeleton-${i}`}>
                  <Table.Td colSpan={columns.length}>
                    <Skeleton height={20} data-slot="skeleton" />
                  </Table.Td>
                </Table.Tr>
              ))}

            {rows.map((row, index) => (
              <Table.Tr
                key={row.id}
                {...(staggerRows
                  ? {
                      component: motion.tr,
                      initial: motionEnabled ? { opacity: 0, y: 4 } : false,
                      animate: { opacity: 1, y: 0 },
                      // Capped at the eleventh row. A per-row delay that keeps
                      // growing means a 27-row table is still arriving a second
                      // after it loaded, and the rows below the fold animate
                      // where nobody is looking. Ten steps of 20ms is 200ms for
                      // the whole cascade however long the table is.
                      transition: motionEnabled
                        ? { delay: Math.min(index, 10) * 0.02, ...transitions.base }
                        : { duration: durations.instant },
                      'data-motion': 'row',
                    }
                  : {})}
                // Mantine's own selected tone, so a selected row reads the same
                // here as a selected item anywhere else in the app.
                bg={selectedRowId === row.id ? 'var(--mantine-color-default-hover)' : undefined}
                data-state={selectedRowId === row.id ? 'selected' : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {row.getVisibleCells().map(cell => (
                  <Table.Td key={cell.id} className={cell.column.columnDef.meta?.cellClassName}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        {showEmpty && <Box py="xl">{empty}</Box>}
      </ScrollArea>

      {/* Outside the ScrollArea on purpose: a pager that scrolls away is a
          control the reader reaches for exactly when it is gone. */}
      {paginated && !isLoading && filteredCount > 0 && (
        <Group
          justify="space-between"
          gap="sm"
          px="md"
          py="xs"
          style={{
            flexShrink: 0,
            borderTop: '1px solid var(--mantine-color-default-border)',
          }}
        >
          <Text size="xs" c="dimmed">
            {firstOnPage}–{lastOnPage} of {filteredCount}
          </Text>
          {pageCount > 1 && (
            <Pagination
              size="sm"
              withEdges={pageCount > 5}
              total={pageCount}
              // Mantine counts from 1 and TanStack from 0. Every bug this
              // component could have starts by forgetting that.
              value={pageIndex + 1}
              onChange={page => table.setPageIndex(page - 1)}
              getControlProps={control => ({ 'aria-label': `${control} page` })}
            />
          )}
        </Group>
      )}
    </Stack>
  );
}
