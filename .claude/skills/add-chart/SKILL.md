---
name: add-chart
description: Build a chart with @mantine/charts — area, bar, line, pie, donut, radar, sparkline. Covers series colours from theme colour names, time-range bucketing, stacked series, tooltips, accessibility, and the sizing pattern. Use when the user asks to add a chart, a graph, a sparkline, or "show X over time".
---

# add-chart — charts through @mantine/charts

Charts are `@mantine/charts`. It wraps recharts, reads this app's theme, and is
the only chart layer here: there is no local chart wrapper to maintain and no
second set of colour tokens to keep in step.

## Read these first

- `src/pages/Dashboard.tsx` — the canonical example: a time-range-aware
  `AreaChart` with three stacked series, plus `StatCard` sparklines. It also
  holds `bucketCustomers()`, the single bucketing function both read from.
- `src/components/stat-card.tsx` — how a `Sparkline` sits inside a KPI tile.
- `docs/principles/motion.md` — for the chart-transition timing.

## The recipe — time-range area chart

```tsx
import { AreaChart } from '@mantine/charts';

import { bucketCustomers } from './buckets'; // see "Time-range bucketing"
import { formatMoneyCompact } from '@/lib/format';

// One hue at rising strength, bottom-up: the tier carrying the most revenue
// sits on the baseline, where a stacked area is easiest to read.
const SERIES = [
  { name: 'enterprise', label: 'Enterprise', color: 'brand.7' },
  { name: 'business', label: 'Business', color: 'brand.5' },
  { name: 'pro', label: 'Pro', color: 'brand.3' },
];

export function RevenueAreaChart({ customers, range }: Props) {
  const { chart } = bucketCustomers(customers, range);

  return (
    <AreaChart
      h={256}
      data={chart}
      dataKey="date"
      type="stacked"
      curveType="monotone"
      withGradient
      withDots={false}
      series={SERIES}
      gridAxis="y"
      tickLine="none"
      // The data is cents. Format at the edge so a raw cent count never
      // reaches an axis label or a tooltip.
      valueFormatter={(value) => formatMoneyCompact(value)}
    />
  );
}
```

## Theme colour names, not hex

A series colour is a bare Mantine colour name — `brand`, `blue`, `violet`,
`yellow`, `gray` — resolved through the same palette every other component
reads. Bare, not `brand.6`: a bare name resolves through `primaryShade`, so
light mode gets the darker step that holds 3:1 against white and dark mode the
bright one; a fixed shade is right in one scheme and invisible in the other.
Instrument keeps colour for meaning, so separate series take separate data hues
(lime, sky, violet, amber), not one hue at several strengths. A retune in
`src/theme.ts` moves the chart with the app. Never a hex literal, never
recharts' own colour scale.

## Time-range bucketing

The Dashboard chart has a `7d / 30d / 90d / 6mo / 1yr` toggle. The bucket
function is the single source of truth — it returns the same shape for the
chart and for any KPI sparklines that depend on it:

```ts
export type Range = '7d' | '30d' | '90d' | '6mo' | '1yr';
export function bucketCustomers(customers: Customer[], range: Range) {
  // Build N buckets (7 daily, 5 weekly, 13 weekly, 6 monthly, 12 monthly).
  return { chart, mrr, customers, churned, signups };
}
```

Wire it from the page:

```tsx
const [range, setRange] = useState<Range>('6mo');
const { data: customers = [] } = useCustomers();
const series = useMemo(() => bucketCustomers(customers, range), [customers, range]);
```

The sparklines receive the number arrays; the chart receives `chart`. They stay
in lockstep because they read from the same bucket.

**Stocks and flows are not bucketed the same way.** Revenue and headcount are a
*stock*: the value is a snapshot at the bucket's **close**, so a customer who
signed up three months ago is still counted today. Signups and churn are a
*flow*: they are counted **inside** the bucket, and each event lands in exactly
one. Mixing the two is the mistake that makes a revenue chart look like a
signup chart — it flattens, because each bucket only ever shows what arrived
during it.

**A derived series has to reconstruct history, not read today's row.**
`Dashboard.tsx` keeps `priorMrr()` for exactly this: a churned account's
`mrrCents` is zero now, so charting the current field draws a book of business
where the lost customers were never there, and the curve never bends.

## Sparklines

`Sparkline` is part of `@mantine/charts` — pass the numbers and let it pick the
tone from the trend:

```tsx
<Sparkline
  h={24}
  data={[12, 14, 11, 18, 22, 19, 24]}
  curveType="monotone"
  fillOpacity={0.12}
  trendColors={{ positive: 'green.6', negative: 'red.6', neutral: 'gray.5' }}
/>
```

`StatCard` already does this when passed a `series` prop, so a KPI tile needs no
chart code of its own.

## Bar / line / pie / donut / radar

Same package, one component each:

```tsx
<BarChart h={240} data={data} dataKey="bucket" series={[{ name: 'count', color: 'brand' }]} />
<LineChart h={240} data={data} dataKey="bucket" series={[{ name: 'x', color: 'brand' }]} />
<PieChart data={[{ name: 'Active', value: 12, color: 'brand' }]} withTooltip />
<DonutChart data={slices} chartLabel="Customers" withTooltip />
<RadarChart h={280} data={data} dataKey="axis" series={[{ name: 'v', color: 'brand', opacity: 0.3 }]} />
```

The legend (`withLegend`) goes below the chart, not inside it.

## Accessibility

- Wrap each chart in `<figure>` with a `<figcaption>` summary like
  `"Recurring revenue by plan over the last 6 months"`. The caption
  is the only thing a screen reader gets.
- Provide the data another way as well — a table, or the tooltip. A chart is a
  visual representation, not the only one.
- Don't animate longer than `300ms`; the presets in `motion.md` apply.

## Don'ts

- **Don't import recharts directly.** It is a transitive dependency of
  `@mantine/charts`, not an API this app uses.
- **Don't use raw hex colours.** Theme colour names or nothing.
- **Don't show more than 5 series.** Past five it is unreadable; split the chart
  or stack it.
- **Don't hand-roll a sparkline.** `Sparkline` exists and is themed.

## Verify

1. Range toggle updates the chart without an animation flash.
2. Hover any data point — the tooltip shows the bucket label and every series
   value, not just the hovered one.
3. Toggle theme — colours swap through the palette, no component change.
4. Resize — the chart shrinks and stays readable.
5. Keyboard tab through — focus lands on the legend / range toggle, not the
   chart canvas.
6. Screen reader — reads the figcaption.

See `ux-prepass` for the mandatory UI gates.
