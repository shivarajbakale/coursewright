import { Badge, Text, type BadgeProps } from '@mantine/core';

import type { CustomerPlan, CustomerStatus } from '@/api/types';

/**
 * The subscription tier, in two forms.
 *
 * `PlanBadge` is the pill, and it is for the places that show *one* account:
 * the detail page's header, where a badge is the thing that says "this is the
 * tier" at a glance. `PlanLabel` is the same fact as text, and it is for the
 * list, where there are twenty-seven of them in a column.
 *
 * The pill and the label are not a style preference. A column of filled pills
 * reads as a column of buttons and takes the eye before the account name does,
 * which is the wrong order for a list whose job is to be scanned. Colour in
 * that table means health; the tier is text, ranked by weight.
 *
 * Two deliberate choices here, both about rank. The tier ladder is drawn in one
 * hue at rising strength rather than four unrelated colours: `free` is the
 * neutral, `enterprise` is the only filled pill on the page, and the eye reads
 * the order without a legend. Health is the one thing allowed to be red, so the
 * plan column never competes with it.
 */
const variants = {
  free: { color: 'gray', variant: 'default' },
  pro: { color: 'brand', variant: 'light' },
  business: { color: 'brand', variant: 'light' },
  enterprise: { color: 'brand', variant: 'filled' },
} as const satisfies Record<CustomerPlan, { color: string; variant: string }>;

const labels = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
  enterprise: 'Enterprise',
} as const satisfies Record<CustomerPlan, string>;

export function PlanBadge({ plan }: { plan: CustomerPlan }) {
  const { color, variant } = variants[plan];
  return (
    <Badge color={color} variant={variant} fw={500} tt="none">
      {labels[plan]}
    </Badge>
  );
}

/** The same ladder as text: the paid tiers read at full strength, `free` recedes. */
export function PlanLabel({ plan }: { plan: CustomerPlan }) {
  return (
    <Text size="sm" c={plan === 'free' ? 'dimmed' : undefined} fw={plan === 'enterprise' ? 500 : 400}>
      {labels[plan]}
    </Text>
  );
}

/**
 * Billing lifecycle, as a Badge — shown only when it is not the happy path.
 *
 * `active` renders nothing on purpose. A badge on every row that says the row
 * is normal is a badge nobody reads, and it drowns the two states that need
 * attention: a trial about to end and an invoice that failed.
 */
const statusTones = {
  trialing: { color: 'blue', label: 'Trial' },
  past_due: { color: 'red', label: 'Past due' },
  churned: { color: 'gray', label: 'Churned' },
} as const satisfies Record<Exclude<CustomerStatus, 'active'>, { color: string; label: string }>;

export function StatusBadge({ status, ...props }: { status: CustomerStatus } & BadgeProps) {
  if (status === 'active') return null;
  const { color, label } = statusTones[status];
  return (
    <Badge color={color} variant="light" size="sm" tt="none" {...props}>
      {label}
    </Badge>
  );
}
