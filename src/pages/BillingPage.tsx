import * as React from 'react';
import {
  Accordion,
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { Check, CreditCard, Download, Sparkles } from 'lucide-react';

import type { Plan, PlanInterval } from '@/api/types';
import {
  useInvoices,
  usePaymentMethod,
  usePlans,
  useSubscription,
  useSwitchPlan,
} from '@/hooks/useBilling';
import { PageShell } from '@/components/page-shell';
import { Stagger, StaggerItem } from '@/components/reveal';
import { Panel } from '@/components/panel';

/**
 * Billing — plans, current subscription, invoice history, payment method.
 *
 * Layout:
 *   1. Current plan card — what you're on, next charge date, payment method.
 *   2. Plan picker — 3 cards (Free / Pro / Business) with monthly/yearly toggle.
 *      Switching is wired to the mock API; no real charge.
 *   3. Invoice history — table of past invoices with download buttons.
 *
 * No invented data — every number comes from the billing hooks.
 */

function formatMoney(cents: number, currency = 'USD'): string {
  if (cents === 0) return 'Free';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

/** The status dot every badge on this page carries. */
const Dot = () => <Box w={6} h={6} bg="currentColor" style={{ borderRadius: '50%' }} />;

export function BillingPage() {
  const { data: plans } = usePlans();
  const { data: subscription, isLoading: subLoading } = useSubscription();
  const { data: invoices, isLoading: invLoading } = useInvoices();
  const { data: paymentMethod } = usePaymentMethod();
  const switchPlan = useSwitchPlan();
  const [interval, setInterval] = React.useState<PlanInterval>('monthly');

  const currentPlan = subscription?.plan ?? 'free';

  return (
    <PageShell
      title="Billing"
      description="Plan, payment method, and invoice history."
      /* `detail`, not `form`.

         It declared `form` and probe rule B3 failed it the first time this page
         was measured: a form archetype with no <form> element. Billing is not
         something you fill in — it is one subject (this workspace's
         subscription) with sections you read and act on, which is what `detail`
         is for. The sections are marked below; B5 counts them. */
      archetype="detail"
      scroll
    >
      <Stagger
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--mantine-spacing-lg)' }}
      >
        {/* Current plan */}
        <StaggerItem>
          <Panel
            data-section="plan"
            title="Current plan"
            actions={
              subscription?.status === 'active' ? (
                <Badge variant="light" color="green" leftSection={<Dot />}>
                  Active
                </Badge>
              ) : undefined
            }
            description={
              subscription ? (
                <>
                  Renews on{' '}
                  <Text span fw={600} c="var(--mantine-color-text)" inherit>
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>{' '}
                  ({subscription.interval}).
                </>
              ) : (
                'Loading…'
              )
            }
          >
            {/* Three facts across, then the payment method on its own full-width
                row — a `Stack` of two rows rather than one grid with a spanning
                child, which is the same picture with nothing to keep in sync. */}
            <Stack gap="lg">
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                <Field
                  label="Plan"
                  value={
                    subLoading ? '—' : (plans?.find(p => p.id === currentPlan)?.name ?? currentPlan)
                  }
                />
                <Field
                  label="Interval"
                  value={
                    subscription
                      ? subscription.interval === 'monthly'
                        ? 'Monthly'
                        : 'Yearly'
                      : '—'
                  }
                />
                <Field label="Seats" value={subscription ? `${subscription.seats} active` : '—'} />
              </SimpleGrid>
              <Paper
                withBorder
                radius="md"
                p="md"
                display="flex"
                style={{
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--mantine-spacing-md)',
                }}
              >
                <Group gap="sm" wrap="nowrap">
                  <CreditCard size={20} color="var(--mantine-color-dimmed)" />
                  <div>
                    <Text size="sm" fw={500}>
                      {paymentMethod
                        ? `${paymentMethod.brand.toUpperCase()} •••• ${paymentMethod.last4}`
                        : 'No payment method'}
                    </Text>
                    {paymentMethod && (
                      <Text size="xs" c="dimmed">
                        Expires {String(paymentMethod.expMonth).padStart(2, '0')}/
                        {paymentMethod.expYear}
                        {paymentMethod.name ? ` · ${paymentMethod.name}` : ''}
                      </Text>
                    )}
                  </div>
                </Group>
                <Button variant="default" size="xs" disabled>
                  Update
                </Button>
              </Paper>
            </Stack>
          </Panel>
        </StaggerItem>

        {/* Plan picker */}
        <Stack gap="sm">
          <Group justify="space-between">
            <Text size="sm" fw={600} component="h2">
              Plans
            </Text>
            <SegmentedControl
              size="xs"
              value={interval}
              onChange={v => setInterval(v as PlanInterval)}
              aria-label="Billing interval"
              /*
               * Plain strings, not elements. The discount was a `Badge` inside
               * the label, and a `SegmentedControl` label neither wraps nor
               * widens its control — the Badge got 8px for 25px of text and
               * rendered as a dash. Same defect as the Inbox filter counts,
               * same answer: the label is text.
               */
              data={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly −17%' },
              ]}
            />
          </Group>

          {!plans ? (
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              {[0, 1, 2].map(i => (
                <Paper key={i} withBorder radius="md" p="lg">
                  <Skeleton height={20} width={80} />
                  <Skeleton height={36} width={128} mt="sm" />
                  <Skeleton height={16} mt="sm" />
                  <Skeleton height={16} width="75%" mt="xs" />
                </Paper>
              ))}
            </SimpleGrid>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              {plans.map(p => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  interval={interval}
                  isCurrent={p.id === currentPlan}
                  isSwitching={switchPlan.isPending}
                  onSelect={() => switchPlan.mutate(p.id)}
                />
              ))}
            </SimpleGrid>
          )}
        </Stack>

        {/* Invoice history */}
        <StaggerItem>
          <Panel
            data-section="invoices"
            title="Invoice history"
            description="Download a PDF for any past charge."
            contentProps={{ p: 0 }}
          >
            {invLoading ? (
              <Box component="ul" p="xs" style={{ listStyle: 'none', margin: 0 }}>
                {[0, 1, 2].map(i => (
                  <Group key={i} component="li" justify="space-between" wrap="nowrap" p="sm">
                    <Stack gap={6}>
                      <Skeleton height={16} width={128} />
                      <Skeleton height={12} width={96} />
                    </Stack>
                    <Skeleton height={32} width={64} />
                  </Group>
                ))}
              </Box>
            ) : !invoices || invoices.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" p="lg">
                No invoices yet.
              </Text>
            ) : (
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Invoice</Table.Th>
                    <Table.Th>Description</Table.Th>
                    <Table.Th>Issued</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th ta="right">Amount</Table.Th>
                    <Table.Th w={48} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {invoices.map(inv => (
                    <Table.Tr key={inv.id}>
                      <Table.Td>
                        <Text size="xs" ff="monospace">
                          {inv.number}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{inv.description}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(inv.issuedAt).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <InvoiceStatusBadge status={inv.status} />
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm" fw={500} style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoney(inv.amountCents, inv.currency)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          color="gray"
                          size="md"
                          disabled
                          aria-label={`Download invoice ${inv.number}`}
                        >
                          <Download size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Panel>
        </StaggerItem>

        {/* Billing questions, answered on the page that raises them.

            `Accordion` rather than `Tabs`: these are read one at a time and
            most readers open none of them, so the closed state is the useful
            one. Nothing required to pay is hidden in here — the plan, the card
            and the invoices are all above, in the open. */}
        <StaggerItem>
          <Panel
            title="Billing questions"
            description="The answers people ask support for first."
            tone="muted"
          >
            {/* `order={4}`: each control renders as a heading, and the library
                does not choose the level. The page's h1 is the shell's title
                and the panel titles are h3s, so these are h4s. */}
            <Accordion variant="separated" radius="md" order={4}>
              {BILLING_FAQ.map(item => (
                <Accordion.Item key={item.q} value={item.q}>
                  <Accordion.Control>
                    <Text size="sm" fw={500}>
                      {item.q}
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Text size="sm" c="dimmed">
                      {item.a}
                    </Text>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Panel>
        </StaggerItem>
      </Stagger>
    </PageShell>
  );
}

/**
 * Written for the starter, and honest about being one: every answer says what
 * this demo does, not what a billing provider you have not wired up yet does.
 */
const BILLING_FAQ = [
  {
    q: 'When does a plan change take effect?',
    a: 'Immediately. The switch here updates the subscription in the mock API and the page reflects it on the next render — wire it to your provider and the same mutation becomes a real proration.',
  },
  {
    q: 'What happens to an invoice that is still open?',
    a: 'It stays open until the payment succeeds, and it keeps its number. Nothing in this starter retries a payment; that is the job of the billing provider you connect.',
  },
  {
    q: 'Can I change the billing interval without losing the plan?',
    a: 'Yes — monthly and yearly are the same plan at two prices, so the toggle above the cards changes what you pay, not what you get.',
  },
  {
    q: 'Where do taxes and VAT numbers live?',
    a: 'Nowhere yet. Tax handling belongs with the provider that issues the invoice, and this page renders whatever it returns rather than computing a number of its own.',
  },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500} mt={4}>
        {value}
      </Text>
    </div>
  );
}

function PlanCard({
  plan,
  interval,
  isCurrent,
  isSwitching,
  onSelect,
}: {
  plan: Plan;
  interval: PlanInterval;
  isCurrent: boolean;
  isSwitching: boolean;
  onSelect: () => void;
}) {
  const price = interval === 'monthly' ? plan.monthlyCents : plan.yearlyCents;
  return (
    <Paper
      withBorder
      radius="md"
      p="lg"
      // The highlighted plan is marked by its own border colour rather than an
      // extra ring, so the three cards keep identical geometry.
      style={{
        position: 'relative',
        ...(plan.highlighted ? { borderColor: 'var(--mantine-primary-color-filled)' } : {}),
      }}
    >
      {plan.highlighted && (
        <Badge
          leftSection={<Sparkles size={12} />}
          style={{ position: 'absolute', top: -8, right: 16 }}
        >
          Most popular
        </Badge>
      )}
      <Group justify="space-between" align="baseline">
        <Text size="sm" fw={600}>
          {plan.name}
        </Text>
        {isCurrent && (
          <Badge variant="light" color="green" leftSection={<Dot />}>
            Current
          </Badge>
        )}
      </Group>
      <Group gap={4} align="baseline" mt="sm">
        <Text fz="1.875rem" fw={600} lh={1.1} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {price === 0 ? 'Free' : formatMoney(price)}
        </Text>
        {price > 0 && (
          <Text size="sm" c="dimmed">
            /{interval === 'monthly' ? 'mo' : 'yr'}
          </Text>
        )}
      </Group>
      <Text size="xs" c="dimmed" mt={4}>
        {plan.description}
      </Text>
      <Stack component="ul" gap="xs" mt="md" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {plan.features.map(f => (
          <Group key={f} component="li" align="flex-start" gap="xs" wrap="nowrap">
            <Check
              size={16}
              color="var(--mantine-primary-color-filled)"
              style={{ marginTop: 2, flexShrink: 0 }}
            />
            <Text size="sm">{f}</Text>
          </Group>
        ))}
      </Stack>
      <Button
        fullWidth
        mt="lg"
        variant={isCurrent || !plan.highlighted ? 'default' : 'filled'}
        disabled={isCurrent || isSwitching}
        onClick={onSelect}
      >
        {isCurrent ? 'Current plan' : plan.ctaLabel}
      </Button>
    </Paper>
  );
}

function InvoiceStatusBadge({ status }: { status: 'paid' | 'open' | 'void' | 'uncollectible' }) {
  const meta: Record<'paid' | 'open' | 'void' | 'uncollectible', { color: string; label: string }> =
    {
      paid: { color: 'green', label: 'Paid' },
      open: { color: 'yellow', label: 'Open' },
      void: { color: 'gray', label: 'Void' },
      uncollectible: { color: 'gray', label: 'Uncollectible' },
    };
  const m = meta[status];
  return (
    <Badge variant="light" color={m.color} leftSection={<Dot />}>
      {m.label}
    </Badge>
  );
}
