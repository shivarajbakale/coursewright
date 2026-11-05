import * as React from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Building2, Plus, Users } from 'lucide-react';

import type { Customer, CustomerStatus } from '@/api/types';
import { useCustomers } from '@/hooks/useCustomers';
import { PageShell } from '@/components/page-shell';
import { customerColumns } from '@/pages/Customers/customer-columns';
import { CustomerForm } from '@/pages/Customers/customer-form';
import {
  Box,
  Button,
  EmptyState,
  Modal,
  SegmentedControl,
  Skeleton,
  Stack,
} from '@mantine/core';

import { DataTable } from '@/components/data-table';

/**
 * Customers — the reference slice, as a `list`.
 *
 * The collection gets the whole width and a row is a link: clicking one goes to
 * `/customers/$customerId`, its own route, where the account has room for a
 * record rather than a column. That is the `list` + `detail` pair rather than
 * `list-detail`, and the difference is the job: `list-detail` earns its second
 * pane when the work is going *through* members without losing your place —
 * triage, review queues. An account is something you look up, read and leave.
 *
 * Lifecycle filter chips sit in the shell's toolbar and act as a quick scope —
 * All / Active / Trials / Past due / Churned. They're client-side filters over
 * the same `useCustomers()` data, so they don't introduce a second fetch, and
 * they are pinned above the rows rather than inside them: probe rule B8 fails a
 * filter that scrolls away, because the user reaches for it exactly when they
 * have scrolled far enough to be lost.
 */
type StatusFilter = 'all' | CustomerStatus;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'trialing', label: 'Trials' },
  { id: 'past_due', label: 'Past due' },
  { id: 'churned', label: 'Churned' },
];

export function CustomersPage() {
  const navigate = useNavigate();
  const { data: customers, isLoading, isError } = useCustomers();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');

  const open = (customer: Customer) =>
    navigate({ to: '/customers/$customerId', params: { customerId: customer.id } });

  const filtered = React.useMemo(() => {
    const list = customers ?? [];
    if (statusFilter === 'all') return list;
    return list.filter(c => c.status === statusFilter);
  }, [customers, statusFilter]);

  // Per-filter counts — used for the chip badges and the empty state copy.
  const counts = React.useMemo(() => {
    const list = customers ?? [];
    return {
      all: list.length,
      active: list.filter(c => c.status === 'active').length,
      trialing: list.filter(c => c.status === 'trialing').length,
      past_due: list.filter(c => c.status === 'past_due').length,
      churned: list.filter(c => c.status === 'churned').length,
    } as Record<StatusFilter, number>;
  }, [customers]);

  const filterLabel =
    STATUS_FILTERS.find(f => f.id === statusFilter)?.label.toLowerCase() ?? 'matching';

  return (
    <PageShell
      title="Customers"
      description="Every account, what they pay, and how they’re doing."
      scroll={false}
      archetype="list"
      bodyProps={{ px: 0 }}
      toolbar={
        /* Plain string labels. `SegmentedControl` takes a `ReactNode`, and the
           temptation is to build one — a span, a dimmed count, a Badge. That is
           what made the Inbox filter row look hand-rolled, and the clipping it
           caused is fixed once in `theme.components.SegmentedControl` rather
           than by every page remembering to guard its own label. */
        <SegmentedControl
          size="xs"
          value={statusFilter}
          onChange={v => setStatusFilter(v as StatusFilter)}
          aria-label="Filter customers by lifecycle"
          data={STATUS_FILTERS.map(f => ({
            value: f.id,
            label: `${f.label} ${counts[f.id]}`,
          }))}
        />
      }
      actions={
        <>
          <Button
            data-primary-action="new-customer"
            leftSection={<Plus size={16} />}
            onClick={() => setCreateOpen(true)}
          >
            New customer
          </Button>
          <Modal
            opened={createOpen}
            onClose={() => setCreateOpen(false)}
            title="New customer"
            size="lg"
            centered
          >
            <CustomerForm
              onCancel={() => setCreateOpen(false)}
              onCreated={id => {
                setCreateOpen(false);
                navigate({ to: '/customers/$customerId', params: { customerId: id } });
              }}
            />
          </Modal>
        </>
      }
    >
      {/*
        A Box, not a Paper, and deliberately so: this is the frame around the
        collection, not a surface painted under it. The rows own the one scroll
        region on screen — `PageShell scroll={false}` above, `min-h-0` here — so
        the title band and the filter chips stay put while the table moves.
      */}
      <Box
        mx="lg"
        h="100%"
        style={{
          minHeight: 0,
          overflow: 'hidden',
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
        }}
      >
        <DataTable
          columns={customerColumns}
          data={filtered}
          getRowId={c => c.id}
          isLoading={isLoading}
          onRowClick={open}
          staggerRows
          // Twelve rows is what fits a laptop viewport without the header
          // leaving the screen, so the pager marks where the fold is rather
          // than inventing a second one below it.
          pageSize={12}
          filterPlaceholder="Filter by name, domain, plan…"
          empty={
            isLoading ? (
              <Stack gap="xs" p="md">
                {[0, 1, 2, 3, 4].map(i => (
                  <Skeleton key={i} height={48} />
                ))}
              </Stack>
            ) : isError ? (
              <EmptyState
                icon={<Building2 size={20} />}
                title="Couldn’t load customers"
                description="The request failed. Check the console, then try again."
              />
            ) : statusFilter !== 'all' && counts.all > 0 ? (
              // No rows *matching a filter* and no rows *at all* are different
              // problems with different fixes, so they get different copy.
              <EmptyState
                icon={<Users size={20} />}
                title={`No ${filterLabel} accounts`}
                description={`You have ${counts.all} customer${counts.all === 1 ? '' : 's'} in total. Switch the filter to see them.`}
              >
                <Button size="xs" variant="default" onClick={() => setStatusFilter('all')}>
                  Show all
                </Button>
              </EmptyState>
            ) : (
              <EmptyState
                icon={<Building2 size={20} />}
                title="No customers yet"
                description="Add your first account to start tracking revenue."
              >
                <Button
                  size="xs"
                  leftSection={<Plus size={16} />}
                  onClick={() => setCreateOpen(true)}
                >
                  New customer
                </Button>
              </EmptyState>
            )
          }
        />
      </Box>
    </PageShell>
  );
}
