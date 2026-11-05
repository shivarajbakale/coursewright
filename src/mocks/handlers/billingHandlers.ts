/**
 * MSW handlers for the Billing resource.
 *
 * Three plans (Free / Pro / Business) plus a 12-month invoice history and a
 * payment method. The user starts on Pro (matches the seats handler in the
 * Team mocks).
 */
import { http, HttpResponse } from 'msw';
import type {
  Invoice,
  PaymentMethod,
  Plan,
  PlanId,
  Subscription,
} from '@/api/types';

const NOW = Date.now();
const day = 86_400_000;

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyCents: 0,
    yearlyCents: 0,
    description: 'For evaluating the workspace or hobby projects.',
    features: [
      'Up to 3 seats',
      'Unlimited projects',
      'Community support',
      'Basic analytics',
    ],
    ctaLabel: 'Downgrade',
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyCents: 2900,
    yearlyCents: 29000,
    description: 'For small teams shipping real product.',
    features: [
      'Up to 25 seats',
      'Unlimited projects',
      'Email support',
      'Advanced analytics',
      'Integrations (GitHub, Slack, Linear, Figma)',
      'Audit log (90 days)',
    ],
    highlighted: true,
    ctaLabel: 'Stay on Pro',
  },
  {
    id: 'business',
    name: 'Business',
    monthlyCents: 9900,
    yearlyCents: 99000,
    description: 'For growing orgs that need controls and SLAs.',
    features: [
      'Unlimited seats',
      'SAML SSO + SCIM',
      'Priority support',
      'Audit log (unlimited)',
      'Custom data retention',
      'Dedicated CSM',
    ],
    ctaLabel: 'Upgrade to Business',
  },
];

let subscription: Subscription = {
  plan: 'pro',
  interval: 'monthly',
  currentPeriodStart: new Date(NOW - 12 * day).toISOString(),
  currentPeriodEnd: new Date(NOW + 18 * day).toISOString(),
  status: 'active',
  seats: 7,
};

const PAYMENT_METHOD: PaymentMethod = {
  id: 'pm_demo',
  brand: 'visa',
  last4: '4242',
  expMonth: 12,
  expYear: 2028,
  name: 'You',
};

const INVOICES: Invoice[] = [
  {
    id: 'inv_2026_0042',
    number: 'INV-2026-0042',
    amountCents: 2900,
    currency: 'USD',
    status: 'paid',
    issuedAt: new Date(NOW - 12 * day).toISOString(),
    paidAt: new Date(NOW - 12 * day).toISOString(),
    description: 'Pro plan — monthly',
  },
  {
    id: 'inv_2026_0030',
    number: 'INV-2026-0030',
    amountCents: 2900,
    currency: 'USD',
    status: 'paid',
    issuedAt: new Date(NOW - 42 * day).toISOString(),
    paidAt: new Date(NOW - 42 * day).toISOString(),
    description: 'Pro plan — monthly',
  },
  {
    id: 'inv_2026_0018',
    number: 'INV-2026-0018',
    amountCents: 2900,
    currency: 'USD',
    status: 'paid',
    issuedAt: new Date(NOW - 72 * day).toISOString(),
    paidAt: new Date(NOW - 72 * day).toISOString(),
    description: 'Pro plan — monthly',
  },
  {
    id: 'inv_2026_0007',
    number: 'INV-2026-0007',
    amountCents: 2900,
    currency: 'USD',
    status: 'paid',
    issuedAt: new Date(NOW - 102 * day).toISOString(),
    paidAt: new Date(NOW - 102 * day).toISOString(),
    description: 'Pro plan — monthly',
  },
  {
    id: 'inv_2026_0001',
    number: 'INV-2026-0001',
    amountCents: 0,
    currency: 'USD',
    status: 'void',
    issuedAt: new Date(NOW - 180 * day).toISOString(),
    description: 'Pro trial',
  },
];

const ok = <T>(data: T, status = 200) =>
  HttpResponse.json({ success: true, data }, { status });

export const billingHandlers = [
  http.get('/api/billing/plans', () => ok(PLANS)),
  http.get('/api/billing/subscription', () => ok(subscription)),
  http.get('/api/billing/invoices', () =>
    ok([...INVOICES].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)))
  ),
  http.get('/api/billing/payment-method', () => ok(PAYMENT_METHOD)),

  http.post('/api/billing/switch', async ({ request }) => {
    const body = (await request.json()) as { plan: PlanId };
    const plan = PLANS.find((p) => p.id === body.plan);
    if (!plan) return HttpResponse.json({ success: false, message: 'Unknown plan' }, { status: 404 });
    subscription = { ...subscription, plan: plan.id };
    return ok(subscription);
  }),
];
