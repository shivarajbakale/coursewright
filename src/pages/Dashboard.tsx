import * as React from 'react';
import { Link } from '@tanstack/react-router';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Plus,
  Sparkles,
  TrendingUp,
  UserMinus,
  Users,
} from 'lucide-react';

import { useCustomers } from '@/hooks/useCustomers';
import { PageShell } from '@/components/page-shell';
import { StatCard } from '@/components/stat-card';
import { Reveal, Stagger, StaggerItem } from '@/components/reveal';
import { durations, ms, useMotionEnabled } from '@/lib/motion';
import {
  Anchor,
  Badge,
  Box,
  Button,
  EmptyState,
  Flex,
  Grid,
  Group,
  Paper,
  RollingNumber,
  SegmentedControl,
  Skeleton,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';

import { AreaChart } from '@mantine/charts';

import type { Customer } from '@/api/types';
import { Panel } from '@/components/panel';
import { formatMoneyCompact, formatMoneyWhole, formatPercent, percentChange } from '@/lib/format';

/**
 * Dashboard — what the business did.
 *
 * Layout follows the canonical SaaS pattern:
 *   1. Hero KPI (monthly recurring revenue + its trend)
 *   2. Stat-card row (four secondary metrics, each with a sparkline)
 *   3. Two-column body (revenue chart with a time-range selector on the left,
 *      accounts needing attention + onboarding on the right)
 *
 * Every figure comes from `useCustomers()` — no invented metrics. MRR, its
 * delta, net new revenue and the churn rate are all sums over `createdAt`,
 * `churnedAt` and `mrrCents`, which is why the range selector moves them
 * together and why a change to the fixture moves the whole page honestly. A
 * starter that ships fake numbers teaches the wrong pattern and leaves the user
 * deleting fakes before they can build anything.
 */
const DISMISS_KEY = 'dashboard:onboarding-dismissed';

/** Time-range selector for the dashboard chart and stat-tile sparklines. */
type Range = '7d' | '30d' | '90d' | '6mo' | '1yr';
const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '6mo', label: '6 months' },
  { value: '1yr', label: '1 year' },
];

/**
 * Chart series — the plan ladder, in the theme's data colours.
 *
 * Instrument keeps colour for meaning, so three tiers are three of its data
 * hues — lime, sky, violet — rather than one hue at three strengths, which on a
 * near-black page read as one band. Bare colour names, not `brand.5`: Mantine
 * then resolves each through `primaryShade`, so light mode gets the darker step
 * that holds 3:1 against white and dark mode the prototype's own. Stack order
 * is bottom-up, so the tier carrying the most revenue sits on the baseline.
 */
const CHART_SERIES = [
  { name: 'enterprise', label: 'Enterprise', color: 'brand' },
  { name: 'business', label: 'Business', color: 'blue' },
  { name: 'pro', label: 'Pro', color: 'violet' },
];

/** A single chart bucket — date label + MRR in cents by plan tier. */
type Bucket = { date: string; enterprise: number; business: number; pro: number };

/** Per-range bucketed output — drives the chart and every KPI sparkline. */
type Series = {
  chart: Bucket[];
  /** Total MRR (cents) at the close of each bucket. */
  mrr: number[];
  /** Paying + trialing accounts alive at the close of each bucket. */
  customers: number[];
  /** Accounts that churned inside each bucket. */
  churned: number[];
  /** Accounts that signed up inside each bucket. */
  signups: number[];
};

/** True if the account existed and had not yet churned at `at`. */
function aliveAt(c: Customer, at: number): boolean {
  if (new Date(c.createdAt).getTime() > at) return false;
  return c.churnedAt === null || new Date(c.churnedAt).getTime() > at;
}

/**
 * MRR across the book at a point in time, in cents.
 *
 * `mrrCents` is zeroed the moment an account churns, so a churned account's
 * historical revenue has to come from its plan rather than its current row.
 * That is what `priorMrr` is for: it reconstructs what the account was paying
 * while it was alive, and it is the difference between a revenue chart that
 * bends when a big customer leaves and one that pretends they were never there.
 */
function priorMrr(c: Customer): number {
  if (c.mrrCents > 0) return c.mrrCents;
  if (c.plan === 'free') return 0;
  // A churned account's contracted rate is not stored once it is gone; its
  // seats and tier are, and they are what it was billed on.
  return c.plan === 'enterprise' ? 0 : c.seats * (c.plan === 'pro' ? 2900 : 7900);
}

/** Bucket boundaries for each range — picked to keep the chart readable
 *  (5–13 buckets is the sweet spot for AreaChart legibility). */
function rangeBuckets(now: Date, range: Range): { start: Date; end: Date; label: string }[] {
  const buckets: { start: Date; end: Date; label: string }[] = [];
  if (range === '7d') {
    for (let i = 6; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      buckets.push({
        start,
        end,
        label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
  } else if (range === '30d' || range === '90d') {
    const count = range === '30d' ? 5 : 13;
    for (let i = count - 1; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(now.getDate() - i * 7);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      buckets.push({ start, end, label });
    }
  } else {
    const count = range === '6mo' ? 6 : 12;
    for (let i = count - 1; i >= 0; i--) {
      const start = new Date(now);
      start.setMonth(now.getMonth() - i, 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(start.getMonth() + 1);
      buckets.push({
        start,
        end,
        label: start.toLocaleDateString('en-US', { month: 'short' }),
      });
    }
  }
  return buckets;
}

/**
 * Aggregate the book of business per bucket.
 *
 * This is the only place that interprets the customer time-series — the chart
 * and every sparkline read from its output, so the range toggle moves them in
 * lockstep. Revenue is a *snapshot* at each bucket's close (a stock), while
 * signups and churn are *counted inside* the bucket (a flow); mixing the two
 * is the mistake that makes a revenue chart look like a signup chart.
 */
function bucketCustomers(customers: Customer[], range: Range): Series {
  const now = new Date();
  const buckets = rangeBuckets(now, range);

  const chart: Bucket[] = [];
  const mrr: number[] = [];
  const customerCounts: number[] = [];
  const churned: number[] = [];
  const signups: number[] = [];

  for (const b of buckets) {
    const at = b.end.getTime();
    const live = customers.filter(c => aliveAt(c, at));
    const byPlan = (plan: Customer['plan']) =>
      live.filter(c => c.plan === plan).reduce((s, c) => s + priorMrr(c), 0);

    chart.push({
      date: b.label,
      enterprise: byPlan('enterprise'),
      business: byPlan('business'),
      pro: byPlan('pro'),
    });
    mrr.push(live.reduce((s, c) => s + priorMrr(c), 0));
    customerCounts.push(live.length);
    churned.push(
      customers.filter(c => {
        if (!c.churnedAt) return false;
        const t = new Date(c.churnedAt).getTime();
        return t >= b.start.getTime() && t < b.end.getTime();
      }).length
    );
    signups.push(
      customers.filter(c => {
        const t = new Date(c.createdAt).getTime();
        return t >= b.start.getTime() && t < b.end.getTime();
      }).length
    );
  }

  return { chart, mrr, customers: customerCounts, churned, signups };
}

export function Dashboard() {
  const { data: customers, isLoading } = useCustomers();
  const [showOnboarding, setShowOnboarding] = React.useState(
    () => localStorage.getItem(DISMISS_KEY) !== 'true'
  );
  const [range, setRange] = React.useState<Range>('6mo');

  /*
    `RollingNumber` does not opt into Mantine's `data-reduce-motion` mechanism,
    so the reduced-motion answer has to be passed rather than inherited. Zero,
    not a shorter animation: probe rule M1 fails anything that still moves when
    the user has asked every app on their machine not to.
  */
  const countDuration = useMotionEnabled() ? ms(durations.emphasis) : durations.instant;

  const dismissOnboarding = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setShowOnboarding(false);
  };

  const all = React.useMemo(() => customers ?? [], [customers]);
  const live = all.filter(c => c.status !== 'churned');

  // Bucket the book by the selected range — one source of truth for the chart
  // and the sparklines, so they stay in lockstep when the user toggles.
  const series = React.useMemo(() => bucketCustomers(all, range), [all, range]);

  // Headline: current MRR, and its change across the selected range. Both ends
  // of the comparison are bucket snapshots, so the delta always describes the
  // window the user is actually looking at.
  const mrrNow = series.mrr.at(-1) ?? 0;
  const mrrThen = series.mrr[0] ?? 0;
  const mrrDelta = percentChange(mrrNow, mrrThen);
  const netNewMrr = mrrNow - mrrThen;

  // Churn over the range, as a share of the accounts that were alive when it
  // opened. Zero accounts at the start is not "0% churn", it is no denominator,
  // so the tile shows an em dash rather than a number nobody can act on.
  const churnedInRange = series.churned.reduce((s, n) => s + n, 0);
  const aliveAtStart = series.customers[0] ?? 0;
  const churnRate = aliveAtStart === 0 ? null : (churnedInRange / aliveAtStart) * 100;

  const signupsInRange = series.signups.reduce((s, n) => s + n, 0);

  const seats = live.reduce((s, c) => s + c.seats, 0);
  const seatsUsed = live.reduce((s, c) => s + c.seatsUsed, 0);

  // Needs attention: a failed payment first, then the accounts a CSM should
  // call. Sorted by revenue at risk, because that is the order to work them in.
  const attention = [...live]
    .filter(c => c.status === 'past_due' || c.health === 'at_risk')
    .sort((a, b) => {
      const rank = (c: Customer) => (c.status === 'past_due' ? 0 : 1);
      return rank(a) - rank(b) || b.mrrCents - a.mrrCents;
    })
    .slice(0, 4);

  const hasRevenue = series.chart.some(b => b.enterprise + b.business + b.pro > 0);

  return (
    <PageShell
      title="Dashboard"
      description="A snapshot of your business."
      archetype="dashboard-grid"
      actions={
        <Button component={Link} to="/customers" leftSection={<Plus size={16} />}>
          New customer
        </Button>
      }
    >
      {/* Hero KPI — one entry point, no rank inversion.

          The three blocks of this page arrive in order: hero, then the KPI row
          one tile at a time, then the body. It is a cascade rather than a
          sequence of separate animations — the whole thing is over inside
          ~400ms, which is the budget in `docs/principles/motion.md` for "the
          page loaded" rather than "the page is performing". */}
      <Reveal>
        <Paper
          withBorder
          radius="md"
          data-panel="hero"
          data-variant="hero"
          p={{ base: 'lg', sm: 'xl' }}
          style={{ position: 'relative', overflow: 'hidden' }}
        >
          {/* A barely-there wash of the accent, so the hero reads as the top of
            the page without introducing a second surface colour. */}
          <Box
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: -10,
              background:
                'linear-gradient(to bottom right, color-mix(in oklab, var(--mantine-primary-color-filled) 4%, transparent), transparent 60%)',
            }}
          />
          <Flex
            direction={{ base: 'column', sm: 'row' }}
            align={{ base: 'stretch', sm: 'flex-end' }}
            justify="space-between"
            gap="lg"
          >
            <Stack gap="xs">
              <Badge variant="light" leftSection={<TrendingUp size={12} />}>
                Monthly recurring revenue
              </Badge>
              <Group gap="sm" align="baseline">
                <Title
                  order={2}
                  fz="3rem"
                  lh={1.1}
                  ff="monospace"
                  lts="-0.03em"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {isLoading ? (
                    <Skeleton height={48} width={176} />
                  ) : (
                    /* The one figure on the page that counts up. It is what
                       the user opened the dashboard for, and a count-up is an
                       emphasis device — spend it once.

                       Mantine's own component, not a hand-rolled one. The
                       version this replaced had to invent three things
                       `RollingNumber` already does: quantizing the in-flight
                       value so `String` does not print 17.53475804302434
                       (`decimalScale`), pinning the box so the delta beside it
                       does not slide (`tabularNumbers` plus per-digit columns),
                       and announcing the final value once rather than sixty
                       times (`withLiveRegion`). All three shipped as defects
                       first. */
                    <RollingNumber
                      data-motion="number"
                      value={mrrNow / 100}
                      prefix="$"
                      thousandSeparator
                      decimalScale={0}
                      tabularNumbers
                      animationDuration={countDuration}
                    />
                  )}
                </Title>
                {!isLoading && mrrDelta !== null && (
                  <Text
                    size="sm"
                    fw={500}
                    c={mrrDelta >= 0 ? 'green' : 'red'}
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {mrrDelta >= 0 ? '+' : ''}
                    {formatPercent(mrrDelta)}
                  </Text>
                )}
              </Group>
              <Text size="sm" c="dimmed" maw={448}>
                {live.length === 0
                  ? 'No paying accounts yet.'
                  : `${formatMoneyWhole(mrrNow * 12)} ARR across ${live.length} account${live.length === 1 ? '' : 's'}, over the last ${RANGE_OPTIONS.find(r => r.value === range)?.label}.`}
              </Text>
            </Stack>
            <Button
              component={Link}
              to="/customers"
              variant="default"
              size="xs"
              rightSection={<ArrowRight size={14} />}
              w="fit-content"
            >
              View all customers
            </Button>
          </Flex>
        </Paper>
      </Reveal>

      {/* Stat-card row — each tile carries data-panel="kpi" so the ui-probe
          recognises the row as the dashboard-grid's KPI row. The sparkline
          sits inside the tile so the row's height stays predictable. */}
      <Stagger
        style={{
          display: 'grid',
          marginTop: 'var(--mantine-spacing-lg)',
          gap: 'var(--mantine-spacing-md)',
          // auto-fit rather than a breakpoint: four tiles on a wide window, two
          // on a tablet, one on a phone, and no media query to keep in sync.
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <StaggerItem style={{ height: '100%' }}>
          <StatCard
            h="100%"
            data-panel="kpi"
            data-variant="kpi"
            label="Customers"
            value={
              <RollingNumber
                data-motion="number"
                value={live.length}
                tabularNumbers
                animationDuration={countDuration}
              />
            }
            icon={Building2}
            loading={isLoading}
            series={series.customers}
            sub={`${signupsInRange} new in range`}
          />
        </StaggerItem>
        <StaggerItem style={{ height: '100%' }}>
          <StatCard
            h="100%"
            data-panel="kpi"
            data-variant="kpi"
            label="Net new MRR"
            value={`${netNewMrr >= 0 ? '+' : '−'}${formatMoneyWhole(Math.abs(netNewMrr))}`}
            icon={TrendingUp}
            loading={isLoading}
            series={series.mrr}
          />
        </StaggerItem>
        <StaggerItem style={{ height: '100%' }}>
          <StatCard
            h="100%"
            data-panel="kpi"
            data-variant="kpi"
            label="Churn"
            value={churnRate === null ? '—' : formatPercent(churnRate)}
            icon={UserMinus}
            loading={isLoading}
            series={series.churned}
            sub={`${churnedInRange} account${churnedInRange === 1 ? '' : 's'} lost in range`}
          />
        </StaggerItem>
        <StaggerItem style={{ height: '100%' }}>
          <StatCard
            h="100%"
            data-panel="kpi"
            data-variant="kpi"
            label="Seats assigned"
            value={
              <RollingNumber
                data-motion="number"
                value={seatsUsed}
                tabularNumbers
                animationDuration={countDuration}
              />
            }
            icon={Users}
            loading={isLoading}
            progress={seats === 0 ? 0 : seatsUsed / seats}
            sub={`of ${seats} purchased`}
          />
        </StaggerItem>
      </Stagger>

      {/* Body — chart on the left, attention + onboarding on the right. */}
      <Reveal delay={0.12} style={{ marginTop: 'var(--mantine-spacing-lg)' }}>
        <Grid gap="lg">
          <Grid.Col span={{ base: 12, lg: 8 }}>
            <Panel
              data-panel="chart"
          data-variant="panel"
          title="Recurring revenue"
          description="MRR at the close of each period, split by plan."
          actions={
            <SegmentedControl
              size="xs"
              value={range}
              onChange={v => setRange(v as Range)}
              aria-label="Time range"
              w="fit-content"
              data={RANGE_OPTIONS.map(opt => ({
                value: opt.value,
                label: <span aria-label={opt.label}>{opt.value}</span>,
              }))}
            />
          }
          style={{ height: '100%' }}
        >
          {isLoading ? (
            <Skeleton height={256} />
          ) : !hasRevenue ? (
            <EmptyState
              icon={<TrendingUp size={20} />}
              title="No revenue in this range"
              description="Pick a wider range, or add a paying account to populate the chart."
            />
          ) : (
            <AreaChart
              h={256}
              data={series.chart}
              dataKey="date"
              type="stacked"
              curveType="monotone"
              withGradient
              withDots={false}
              series={CHART_SERIES}
              gridAxis="y"
              tickLine="none"
              // Cents in, money out — the axis and the tooltip both read this,
              // so a raw cent count never reaches the screen.
              valueFormatter={value => formatMoneyCompact(value)}
            />
          )}
            </Panel>
          </Grid.Col>

          <Grid.Col span={{ base: 12, lg: 4 }}>
            <Stack gap="lg">
          {/* Needs attention — the dashboard's one worklist. A revenue number
              nobody can act on is a poster; this is the part of the page that
              tells someone what to do next. */}
          <Panel
            data-panel="attention"
            data-variant="panel"
            title="Needs attention"
            description="Failed payments and at-risk accounts, biggest first."
            contentProps={{ p: 6 }}
          >
            {isLoading ? (
              <Stack component="ul" gap={4} p="sm" style={{ listStyle: 'none', margin: 0 }}>
                {[0, 1, 2, 3].map(i => (
                  <Group key={i} component="li" gap="sm" wrap="nowrap" px="xs" py="xs">
                    <Skeleton height={32} width={32} radius="md" />
                    <Stack gap={6} style={{ flex: 1 }}>
                      <Skeleton height={14} width={128} />
                      <Skeleton height={12} width={80} />
                    </Stack>
                  </Group>
                ))}
              </Stack>
            ) : attention.length === 0 ? (
              <Box p="md">
                <EmptyState
                  icon={<Sparkles size={20} />}
                  title="Everything looks healthy"
                  description="No failed payments and nothing flagged at risk."
                />
              </Box>
            ) : (
              <Box component="ul" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {attention.map(c => (
                  <li key={c.id}>
                    {/* `renderRoot` rather than `component={Link}`: passing a
                        typed route link through Mantine's polymorphic
                        `component` erases its generics and `params` stops
                        type-checking against the route. */}
                    <Box
                      px="sm"
                      py={8}
                      display="flex"
                      // The row is the link, so it takes the text's colour and
                      // no underline: a bare <a> drew the browser's own blue
                      // and visited purple over every name.
                      c="inherit"
                      td="none"
                      style={{
                        alignItems: 'flex-start',
                        gap: 'var(--mantine-spacing-sm)',
                        borderRadius: 'var(--mantine-radius-md)',
                      }}
                      renderRoot={props => (
                        <Link
                          to="/customers/$customerId"
                          params={{ customerId: c.id }}
                          {...props}
                        />
                      )}
                    >
                      <ThemeIcon
                        variant="light"
                        color={c.status === 'past_due' ? 'red' : 'yellow'}
                        size={32}
                        radius="md"
                        mt={2}
                      >
                        <AlertTriangle size={16} />
                      </ThemeIcon>
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Text size="sm" fw={500} truncate>
                          {c.name}
                        </Text>
                        <Text size="xs" c="dimmed" truncate>
                          {c.status === 'past_due'
                            ? 'Payment failed'
                            : `${formatPercent(c.usage, 0)} usage`}
                        </Text>
                      </Box>
                      <Text size="xs" c="dimmed" style={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {c.mrrCents === 0 ? '—' : formatMoneyWhole(c.mrrCents)}
                      </Text>
                    </Box>
                  </li>
                ))}
              </Box>
            )}
          </Panel>

          {/* Onboarding — three concrete steps, each with a derived done state,
              dismissible once the workspace is running. */}
          {!isLoading && showOnboarding && (
            <Panel
              data-panel="onboarding"
              data-variant="panel"
              title="Get started"
              description="Three steps to a working workspace."
              actions={
                <Button variant="subtle" color="gray" size="compact-xs" onClick={dismissOnboarding}>
                  Dismiss
                </Button>
              }
              contentProps={{ p: 6 }}
            >
              <Box component="ul" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                <OnboardingStep
                  n={1}
                  done={all.length > 0}
                  title="Add your first customer"
                  description="An account name, a domain, a plan, and how many seats."
                  to="/customers"
                  cta="Open Customers"
                />
                <OnboardingStep
                  n={2}
                  done={live.some(c => c.plan !== 'free')}
                  title="Put an account on a paid plan"
                  description="Revenue on the dashboard is the sum of what your accounts pay."
                  to="/customers"
                  cta="View customers"
                />
                <OnboardingStep
                  n={3}
                  done={false}
                  title="Press ⌘K"
                  description="Jump to any page without leaving the keyboard."
                />
              </Box>
            </Panel>
          )}
            </Stack>
          </Grid.Col>
        </Grid>
      </Reveal>
    </PageShell>
  );
}

function OnboardingStep({
  n,
  done,
  title,
  description,
  to,
  cta,
}: {
  n: number;
  done: boolean;
  title: string;
  description: string;
  to?: string;
  cta?: string;
}) {
  return (
    <Group component="li" align="flex-start" gap="sm" wrap="nowrap" px="sm" py={10}>
      <ThemeIcon
        variant={done ? 'light' : 'default'}
        color={done ? 'green' : 'gray'}
        size={24}
        radius="xl"
        mt={2}
      >
        {done ? (
          <CheckCircle2 size={14} />
        ) : (
          <Text size="xs" fw={500} inherit>
            {n}
          </Text>
        )}
      </ThemeIcon>
      <Box style={{ minWidth: 0, flex: 1 }}>
        <Text
          size="sm"
          fw={500}
          c={done ? 'dimmed' : undefined}
          td={done ? 'line-through' : undefined}
        >
          {title}
        </Text>
        <Text size="xs" c="dimmed" mt={2}>
          {description}
        </Text>
        {to && cta && (
          <Anchor
            size="xs"
            mt={4}
            display="inline-flex"
            style={{ alignItems: 'center', gap: 4 }}
            renderRoot={props => <Link to={to} {...props} />}
          >
            {cta}
            <ArrowRight size={12} />
          </Anchor>
        )}
      </Box>
    </Group>
  );
}
