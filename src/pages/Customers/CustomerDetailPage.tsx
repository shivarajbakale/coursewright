import { Link, useNavigate, useParams } from '@tanstack/react-router';
import {
  ActionIcon,
  Anchor,
  Avatar,
  Button,
  Box,
  DataList,
  EmptyState,
  Group,
  Menu,
  Progress,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { ArrowLeft, Building2, Mail, Minus, MoreHorizontal, Plus, Trash2 } from 'lucide-react';

import { useCustomer, useUpdateCustomer, useDeleteCustomer } from '@/hooks/useCustomers';
import { PageShell } from '@/components/page-shell';
import { Reveal, Stagger, StaggerItem } from '@/components/reveal';
import { Panel } from '@/components/panel';
import { StatCard } from '@/components/stat-card';
import { formatMoneyWhole, formatPercent } from '@/lib/format';
import { HealthBadge } from '@/pages/Customers/HealthBadge';
import { PlanBadge, StatusBadge } from '@/pages/Customers/PlanBadge';

/** Whole months between a date and now, floored at zero. */
function monthsSince(iso: string): number {
  const then = new Date(iso);
  const now = new Date();
  const months = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
  return Math.max(0, months);
}

/**
 * One customer, on its own route — the `detail` archetype.
 *
 * The account gets the whole width, which is the reason this is a route rather
 * than a pane: a record is read, and reading needs titled sections a person can
 * skip through. Every section carries `data-section` so probe rule B5 can count
 * them, and the primary action lives in the title band, outside the scroll
 * region, because the action a page exists for must be reachable at any scroll
 * position.
 *
 * The `h1` is the account's name, not "Customer". A detail page that spends its
 * headline on the category the nav rail already showed has no headline.
 */
export function CustomerDetailPage() {
  const navigate = useNavigate();
  const { customerId } = useParams({ strict: false }) as { customerId?: string };
  const id = customerId ?? '';
  const { data: customer, isLoading, isError } = useCustomer(id);
  const update = useUpdateCustomer(id);
  const remove = useDeleteCustomer();

  const backToList = () => navigate({ to: '/customers' });

  const breadcrumb = (
    <Anchor
      size="xs"
      c="dimmed"
      display="inline-flex"
      style={{ alignItems: 'center', gap: 4 }}
      renderRoot={props => <Link to="/customers" {...props} />}
    >
      <ArrowLeft size={12} />
      Customers
    </Anchor>
  );

  if (isLoading) {
    // The skeleton declares the same archetype and the same sections as the
    // record it is loading. A loading state is one of the four states of *this*
    // page, not a different page, so it stays measurable — and it keeps the
    // section titles rather than blanking them: the labels are known before the
    // data is, and a skeleton that hides them makes the content jump when it
    // lands.
    return (
      <PageShell archetype="detail" title="Loading…" breadcrumb={breadcrumb}>
        <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="md" mb="lg">
          {['Monthly recurring revenue', 'Annual run rate', 'Seats assigned', 'Customer since'].map(
            label => (
              <StatCard key={label} label={label} value="—" loading />
            )
          )}
        </SimpleGrid>
        <Box
          display="grid"
          style={{ gap: 'var(--mantine-spacing-lg)', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}
        >
          <Stack gap="lg" style={{ gridColumn: 'span 2' }}>
            <Panel
              data-section="seats"
              title="Seats"
              description="What the subscription is billed on."
            >
              <Skeleton height={72} data-slot="skeleton" />
            </Panel>
            <Panel
              data-section="usage"
              title="Product usage"
              description="Share of purchased seats active in the last 30 days."
            >
              <Skeleton height={72} data-slot="skeleton" />
            </Panel>
          </Stack>
          <Stack gap="lg">
            <Panel data-section="contact" title="Contact" contentProps={{ p: "md" }}>
              <Skeleton height={56} data-slot="skeleton" />
            </Panel>
            <Panel data-section="record" title="Record" contentProps={{ p: "md" }}>
              <Skeleton height={140} data-slot="skeleton" />
            </Panel>
          </Stack>
        </Box>
      </PageShell>
    );
  }

  if (isError || !customer) {
    return (
      <PageShell title="Customer not found" breadcrumb={breadcrumb}>
        <EmptyState
          icon={<Building2 size={20} />}
          title="We couldn’t find that account"
          description="It may have been removed. Go back to the list and pick another."
        >
          <Button size="xs" variant="default" onClick={backToList}>
            Back to customers
          </Button>
        </EmptyState>
      </PageShell>
    );
  }

  // Seats are the one field a CSM changes daily, so they get the inline
  // control. The handler clamps rather than validates: a stepper that can be
  // driven below one seat is a stepper that files a support ticket.
  const setSeats = (delta: number) => update.mutate({ seats: Math.max(1, customer.seats + delta) });

  const months = monthsSince(customer.createdAt);
  const seatFill = customer.seats === 0 ? 0 : (customer.seatsUsed / customer.seats) * 100;

  /**
   * The confirm step is a modal from the manager rather than a component in the
   * tree: a destructive confirm has no state of its own and no place in the
   * layout, and `ui-lint`'s native-dialog rule points here.
   */
  const confirmDelete = () =>
    modals.openConfirmModal({
      title: 'Remove this customer?',
      children: (
        <Text size="sm">
          “{customer.name}” will be permanently removed, along with its billing history in this
          view. This can’t be undone.
        </Text>
      ),
      labels: { confirm: 'Remove', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => remove.mutate(customer.id, { onSuccess: backToList }),
    });

  return (
    <PageShell
      archetype="detail"
      breadcrumb={breadcrumb}
      title={customer.name}
      description={`${customer.domain} · ${customer.owner.name}`}
      actions={
        <>
          {/* One primary, and it is the thing you actually do from an account
              page. Everything else collapses into the overflow — a row of five
              buttons has no primary. */}
          <Button
            data-primary-action="email-owner"
            component="a"
            href={`mailto:${customer.owner.email}`}
            leftSection={<Mail size={16} />}
          >
            Email owner
          </Button>
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="default" size="lg" aria-label="More actions">
                <MoreHorizontal size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                color="red"
                leftSection={<Trash2 size={16} />}
                onClick={confirmDelete}
              >
                Remove customer
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </>
      }
    >
      {/* Identity band — avatar, plan, lifecycle, health. The one place the
          account's status is stated, so no section has to repeat it. */}
      <Group gap="md" wrap="nowrap" mb="lg">
        <Avatar name={customer.name} color="initials" size={56} radius="md" />
        <Group gap="xs">
          <PlanBadge plan={customer.plan} />
          <StatusBadge status={customer.status} />
          <HealthBadge health={customer.health} />
        </Group>
      </Group>

      <Reveal>
        <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="md" mb="lg">
          <StatCard
            label="Monthly recurring revenue"
            value={customer.mrrCents === 0 ? '—' : formatMoneyWhole(customer.mrrCents)}
            sub={customer.plan === 'enterprise' ? 'Contracted' : `${customer.seats} × list price`}
          />
          <StatCard
            label="Annual run rate"
            value={customer.mrrCents === 0 ? '—' : formatMoneyWhole(customer.mrrCents * 12)}
            sub="MRR × 12"
          />
          <StatCard
            label="Seats assigned"
            value={`${customer.seatsUsed}`}
            progress={customer.seats === 0 ? 0 : customer.seatsUsed / customer.seats}
            sub={`of ${customer.seats} purchased`}
          />
          <StatCard
            label="Customer since"
            value={new Date(customer.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              year: 'numeric',
            })}
            sub={months === 0 ? 'This month' : `${months} month${months === 1 ? '' : 's'}`}
          />
        </SimpleGrid>
      </Reveal>

      {/* The four sections arrive in reading order. Variant propagation runs
          down the React tree rather than the DOM, so the two column `div`s in
          between are invisible to it and the left column's panels still
          sequence with the right column's. */}
      <Stagger style={{ display: 'grid', gap: 'var(--mantine-spacing-lg)', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <Stack gap="lg" style={{ gridColumn: 'span 2' }}>
          <StaggerItem>
            <Panel
              data-section="seats"
              title="Seats"
              description="What the subscription is billed on."
            >
              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {customer.seatsUsed} of {customer.seats} assigned
                </Text>
                <Group gap="xs">
                  <Button
                    variant="default"
                    size="xs"
                    leftSection={<Minus size={16} />}
                    onClick={() => setSeats(-1)}
                    disabled={update.isPending || customer.seats <= 1}
                  >
                    Seat
                  </Button>
                  <Button
                    variant="default"
                    size="xs"
                    leftSection={<Plus size={16} />}
                    onClick={() => setSeats(1)}
                    disabled={update.isPending}
                  >
                    Seat
                  </Button>
                </Group>
              </Group>
              <Progress value={seatFill} size="md" mt="sm" />
              <Text size="xs" c="dimmed" mt="xs">
                Changing the seat count reprices the subscription immediately on every tier except
                Enterprise, which is contracted.
              </Text>
            </Panel>
          </StaggerItem>

          <StaggerItem>
            <Panel
              data-section="usage"
              title="Product usage"
              description="Share of purchased seats active in the last 30 days."
            >
              <Group justify="space-between" align="center">
                <Text size="1.5rem" fw={600} lh={1.2} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {formatPercent(customer.usage, 0)}
                </Text>
                <HealthBadge health={customer.health} />
              </Group>
              <Progress
                value={customer.usage}
                size="md"
                mt="sm"
                color={customer.usage >= 60 ? 'green' : customer.usage >= 30 ? 'yellow' : 'red'}
              />
              <Text size="xs" c="dimmed" mt="xs">
                Health is scored by the backend from usage, support history and payment record — not
                derived from this number alone.
              </Text>
            </Panel>
          </StaggerItem>
        </Stack>

        <Stack gap="lg">
          <StaggerItem>
            <Panel data-section="contact" title="Contact" contentProps={{ p: "md" }}>
              <Text size="sm" fw={500}>
                {customer.owner.name}
              </Text>
              <Anchor size="sm" href={`mailto:${customer.owner.email}`} display="block" mt={2}>
                {customer.owner.email}
              </Anchor>
              <Text size="xs" c="dimmed" mt="xs">
                {customer.domain}
              </Text>
            </Panel>
          </StaggerItem>

          <StaggerItem>
            <Panel data-section="record" title="Record" contentProps={{ p: "md" }}>
              {/* Mantine's `DataList`, not a hand-built `dl`.

                  This was a 1px-gap `SimpleGrid` over a `Box component="dl"`
                  with a local `Meta` helper painting each cell — a definition
                  list reimplemented, dividers and label column included.
                  `DataList` is the component for exactly that, and `withDivider`
                  is the rule between rows. */}
              <DataList withDivider labelWidth={110}>
                <DataList.Item>
                  <DataList.ItemLabel>Signed up</DataList.ItemLabel>
                  <DataList.ItemValue>
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </DataList.ItemValue>
                </DataList.Item>
                <DataList.Item>
                  <DataList.ItemLabel>Last activity</DataList.ItemLabel>
                  <DataList.ItemValue>
                    {new Date(customer.updatedAt).toLocaleString()}
                  </DataList.ItemValue>
                </DataList.Item>
                <DataList.Item>
                  <DataList.ItemLabel>Lifecycle</DataList.ItemLabel>
                  <DataList.ItemValue tt="capitalize">
                    {customer.status.replace('_', ' ')}
                  </DataList.ItemValue>
                </DataList.Item>
                <DataList.Item>
                  <DataList.ItemLabel>Account ID</DataList.ItemLabel>
                  <DataList.ItemValue ff="monospace">{customer.id.slice(0, 8)}</DataList.ItemValue>
                </DataList.Item>
              </DataList>
            </Panel>
          </StaggerItem>
        </Stack>
      </Stagger>
    </PageShell>
  );
}
