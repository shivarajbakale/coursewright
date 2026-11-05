/**
 * Billing types — the three Plan cards and the Invoice history table.
 *
 * Plan pricing is cents (avoid float drift). The dashboard reads
 * `currentPlan`; the Billing page lets the user switch (mock — no real
 * charge). Invoices are a flat list, paginated client-side for the
 * starter.
 */

export type PlanInterval = 'monthly' | 'yearly';
export type PlanId = 'free' | 'pro' | 'business';

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in cents (yearly = monthly * 10, shown as "save 17%"). */
  monthlyCents: number;
  yearlyCents: number;
  description: string;
  features: string[];
  /** Highlighted as "Most popular" in the picker. */
  highlighted?: boolean;
  ctaLabel: string;
}

export interface Subscription {
  plan: PlanId;
  interval: PlanInterval;
  /** ISO date the current period started. */
  currentPeriodStart: string;
  /** ISO date the current period ends (and the next charge lands). */
  currentPeriodEnd: string;
  /** "active" | "trialing" | "past_due" | "canceled" */
  status: 'active' | 'trialing' | 'past_due' | 'canceled';
  seats: number;
}

export type InvoiceStatus = 'paid' | 'open' | 'void' | 'uncollectible';

export interface Invoice {
  id: string;
  number: string; // e.g. "INV-2026-0042"
  amountCents: number;
  currency: 'USD';
  status: InvoiceStatus;
  issuedAt: string;
  paidAt?: string;
  /** Human label, e.g. "Pro plan — monthly". */
  description: string;
}

export interface PaymentMethod {
  id: string;
  brand: 'visa' | 'mastercard' | 'amex' | 'discover';
  last4: string;
  expMonth: number;
  expYear: number;
  /** Optional billing name. */
  name?: string;
}
