/**
 * Customer domain types — the reference resource.
 *
 * This is the shape shared end-to-end: MSW handler → service → query hooks →
 * pages. Copy this file (and its siblings in the slice) when adding a new
 * resource; the `add-feature` skill automates the whole vertical.
 *
 * A customer is the account, not the person. That distinction is why `seats`
 * and `owner` are separate fields: the account is what carries a subscription,
 * and the dashboard's revenue figures are sums over accounts. `src/api/types/
 * team.types.ts` covers the other direction — the people inside *your* own
 * workspace.
 */

/** Subscription tier. `free` accounts contribute no MRR, and the list shows
 *  them because a free account is a conversion opportunity, not noise. */
export type CustomerPlan = 'free' | 'pro' | 'business' | 'enterprise';

/** Where the account sits in its billing lifecycle. */
export type CustomerStatus = 'trialing' | 'active' | 'past_due' | 'churned';

/**
 * Account health, as the backend scores it.
 *
 * Stored rather than derived on the client: a real health score folds in
 * support tickets, usage trend and payment history, none of which the frontend
 * can see. Deriving it here from the one signal that *is* visible would look
 * like a real score while being a restatement of usage.
 */
export type CustomerHealth = 'healthy' | 'watch' | 'at_risk';

export interface Customer {
  id: string;
  /** Account name, e.g. "Northwind Labs". */
  name: string;
  /** Primary email domain — the account's identity in most B2B products. */
  domain: string;
  plan: CustomerPlan;
  status: CustomerStatus;
  health: CustomerHealth;
  /** Seats purchased on the subscription. */
  seats: number;
  /** Seats actually assigned to a user — `seatsUsed <= seats`. */
  seatsUsed: number;
  /** Monthly recurring revenue in cents. Zero for `free` and `churned`. */
  mrrCents: number;
  /** Product engagement, 0–100. Drives the usage column and the health chip. */
  usage: number;
  owner: { name: string; email: string };
  /** Signup date. The dashboard's revenue time-series is built from this. */
  createdAt: string;
  updatedAt: string;
  /** Set when `status` is `churned`; null otherwise. Together with `createdAt`
   *  it is what makes historical MRR derivable rather than invented. */
  churnedAt: string | null;
}

export interface CreateCustomerDto {
  name: string;
  domain: string;
  plan?: CustomerPlan;
  seats?: number;
}

export type UpdateCustomerDto = Partial<CreateCustomerDto> & {
  status?: CustomerStatus;
  seatsUsed?: number;
};

/** Per-seat list price in cents. `enterprise` is negotiated, so the seeded
 *  accounts carry their own contracted MRR and this table has no entry for it. */
export const PLAN_PRICE_CENTS: Record<Exclude<CustomerPlan, 'enterprise'>, number> = {
  free: 0,
  pro: 2900,
  business: 7900,
};
