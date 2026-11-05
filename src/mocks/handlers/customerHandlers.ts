/**
 * MSW handlers for the Customers resource.
 *
 * Lets the frontend run with no backend: `VITE_ENABLE_MOCKING=true` routes
 * `/api/customers*` here. State is in-memory (resets on reload). When your real
 * API is ready, delete this file from the handler list — the service/hooks/pages
 * are unchanged.
 *
 * The seed is deliberately shaped like a real book of business rather than a
 * uniform list: signups spread over roughly fourteen months and weighted toward
 * the recent quarters, a long tail of free accounts, a handful of enterprise
 * contracts carrying most of the revenue, and four churned accounts — two of
 * them far enough back that a six-month window shows a growing book rather than
 * a shrinking one. The dashboard derives every figure it shows from these
 * rows — MRR, its month-over-month delta and the churn rate are sums over
 * `createdAt` / `churnedAt`, so a change here moves the chart honestly instead
 * of leaving a hard-coded headline behind.
 */
import { http, HttpResponse } from 'msw';
import type {
  Customer,
  CustomerHealth,
  CustomerPlan,
  CustomerStatus,
  CreateCustomerDto,
  UpdateCustomerDto,
} from '@/api/types';
import { PLAN_PRICE_CENTS } from '@/api/types';

function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
}

const DAY = 86_400_000;

/**
 * One row of the seed table.
 *
 * `age` is days since signup and `churn` is days since the account churned, so
 * the fixture stays correct however long after it was written the app is run —
 * a fixture with absolute dates ages into an empty chart.
 */
type Seed = {
  name: string;
  domain: string;
  plan: CustomerPlan;
  status: CustomerStatus;
  health: CustomerHealth;
  seats: number;
  seatsUsed: number;
  usage: number;
  owner: string;
  age: number;
  /** Contracted MRR in cents — enterprise only; other tiers are seats × list. */
  mrr?: number;
  churn?: number;
};

const SEEDS: Seed[] = [
  // Enterprise — few accounts, most of the revenue.
  { name: 'Northwind Labs', domain: 'northwind.io', plan: 'enterprise', status: 'active', health: 'healthy', seats: 240, seatsUsed: 221, usage: 88, owner: 'Dana Whitfield', age: 415, mrr: 1_240_000 },
  { name: 'Halcyon Freight', domain: 'halcyonfreight.com', plan: 'enterprise', status: 'active', health: 'healthy', seats: 180, seatsUsed: 154, usage: 81, owner: 'Marcus Bell', age: 362, mrr: 890_000 },
  { name: 'Verity Health', domain: 'verityhealth.org', plan: 'enterprise', status: 'active', health: 'watch', seats: 120, seatsUsed: 74, usage: 47, owner: 'Priya Raman', age: 298, mrr: 610_000 },

  // Business — the middle of the book.
  { name: 'Cobalt Studio', domain: 'cobalt.studio', plan: 'business', status: 'active', health: 'healthy', seats: 42, seatsUsed: 39, usage: 92, owner: 'Sofia Marchetti', age: 331 },
  { name: 'Ridgeline Capital', domain: 'ridgeline.capital', plan: 'business', status: 'active', health: 'healthy', seats: 35, seatsUsed: 30, usage: 76, owner: 'Tom Ashby', age: 274 },
  { name: 'Fernpath Robotics', domain: 'fernpath.ai', plan: 'business', status: 'active', health: 'at_risk', seats: 28, seatsUsed: 9, usage: 18, owner: 'Wen Li', age: 240 },
  { name: 'Brightside Media', domain: 'brightside.media', plan: 'business', status: 'past_due', health: 'at_risk', seats: 24, seatsUsed: 22, usage: 64, owner: 'Amara Okafor', age: 205 },
  { name: 'Tidewater Logistics', domain: 'tidewater.co', plan: 'business', status: 'active', health: 'healthy', seats: 22, seatsUsed: 20, usage: 84, owner: 'Jonas Ek', age: 168 },
  { name: 'Kestrel Security', domain: 'kestrelsec.com', plan: 'business', status: 'active', health: 'watch', seats: 18, seatsUsed: 11, usage: 52, owner: 'Nadia Haddad', age: 121 },
  { name: 'Northgate Manufacturing', domain: 'northgate-mfg.com', plan: 'business', status: 'active', health: 'healthy', seats: 30, seatsUsed: 26, usage: 74, owner: 'Greta Lindholm', age: 58 },

  // Pro — the volume tier.
  { name: 'Alder & Finch', domain: 'alderfinch.com', plan: 'pro', status: 'active', health: 'healthy', seats: 14, seatsUsed: 13, usage: 79, owner: 'Grace Lindqvist', age: 352 },
  { name: 'Quarry Analytics', domain: 'quarry.dev', plan: 'pro', status: 'active', health: 'healthy', seats: 12, seatsUsed: 12, usage: 90, owner: 'Diego Salas', age: 289 },
  { name: 'Meridian Design', domain: 'meridian.design', plan: 'pro', status: 'active', health: 'watch', seats: 10, seatsUsed: 6, usage: 41, owner: 'Elise Fontaine', age: 231 },
  { name: 'Copperline Foods', domain: 'copperline.co', plan: 'pro', status: 'active', health: 'healthy', seats: 9, seatsUsed: 8, usage: 71, owner: 'Ravi Menon', age: 187 },
  { name: 'Saltmarsh Studio', domain: 'saltmarsh.studio', plan: 'pro', status: 'active', health: 'healthy', seats: 8, seatsUsed: 7, usage: 68, owner: 'Iris Novak', age: 143 },
  { name: 'Junction Labs', domain: 'junctionlabs.io', plan: 'pro', status: 'active', health: 'healthy', seats: 7, seatsUsed: 7, usage: 86, owner: 'Ben Carraway', age: 96 },
  { name: 'Vellum Publishing', domain: 'vellumpub.com', plan: 'pro', status: 'active', health: 'healthy', seats: 12, seatsUsed: 11, usage: 80, owner: 'Tomas Ferreira', age: 100 },
  { name: 'Peakform Fitness', domain: 'peakform.app', plan: 'pro', status: 'trialing', health: 'watch', seats: 6, seatsUsed: 3, usage: 34, owner: 'Lena Brandt', age: 21 },
  { name: 'Wavelength Audio', domain: 'wavelength.fm', plan: 'pro', status: 'trialing', health: 'healthy', seats: 5, seatsUsed: 5, usage: 73, owner: 'Oscar Deleon', age: 11 },

  // Free — the conversion pool.
  { name: 'Fable Bookshop', domain: 'fablebooks.com', plan: 'free', status: 'active', health: 'watch', seats: 3, seatsUsed: 2, usage: 29, owner: 'Hana Yoshida', age: 158 },
  { name: 'Trailhead Outfitters', domain: 'trailhead.co', plan: 'free', status: 'active', health: 'healthy', seats: 3, seatsUsed: 3, usage: 57, owner: 'Cole Barrett', age: 74 },
  { name: 'Lantern Ventures', domain: 'lantern.vc', plan: 'free', status: 'active', health: 'at_risk', seats: 2, seatsUsed: 1, usage: 8, owner: 'Mira Solberg', age: 38 },
  { name: 'Pinecrest Dental', domain: 'pinecrest.care', plan: 'free', status: 'trialing', health: 'healthy', seats: 2, seatsUsed: 2, usage: 62, owner: 'Ahmed Faris', age: 5 },

  // Churned — what makes the churn rate and the MRR delta real.
  { name: 'Orchard Retail', domain: 'orchardretail.com', plan: 'business', status: 'churned', health: 'at_risk', seats: 26, seatsUsed: 0, usage: 0, owner: 'Paul Verner', age: 318, churn: 265 },
  { name: 'Silverline Travel', domain: 'silverline.travel', plan: 'pro', status: 'churned', health: 'at_risk', seats: 11, seatsUsed: 0, usage: 0, owner: 'Yara Nasser', age: 262, churn: 191 },
  { name: 'Cinder Games', domain: 'cindergames.gg', plan: 'pro', status: 'churned', health: 'at_risk', seats: 8, seatsUsed: 0, usage: 0, owner: 'Kit Alvarez', age: 194, churn: 42 },
  { name: 'Harbourview Legal', domain: 'harbourview.law', plan: 'free', status: 'churned', health: 'at_risk', seats: 2, seatsUsed: 0, usage: 0, owner: 'Rosa Iglesias', age: 129, churn: 88 },
];

/** Seats × list price, except enterprise, which carries a contracted figure. */
function mrrFor(seed: Seed): number {
  if (seed.status === 'churned') return 0;
  if (seed.plan === 'enterprise') return seed.mrr ?? 0;
  return seed.seats * PLAN_PRICE_CENTS[seed.plan];
}

/**
 * A stable, readable id for a seeded account.
 *
 * Not `crypto.randomUUID()`, and the reason is the whole point of putting the
 * record on its own route: a seed that re-randomises its ids every page load
 * makes every deep link, bookmark and reload a 404, which is exactly the
 * behaviour the route exists to avoid. Accounts created at runtime still get a
 * uuid — they have no fixture to be stable against.
 */
function seedId(domain: string): string {
  return `cus_${domain.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

function seed(): Customer[] {
  const now = Date.now();
  return SEEDS.map((s) => {
    const createdAt = new Date(now - s.age * DAY).toISOString();
    const churnedAt = s.churn === undefined ? null : new Date(now - s.churn * DAY).toISOString();
    // Last touch: the churn date if the account is gone, otherwise a recent
    // moment scaled by how engaged the account is — a dormant account has not
    // been updated today.
    const updatedAt =
      churnedAt ?? new Date(now - Math.round((100 - s.usage) * 0.6) * DAY - 3_600_000).toISOString();
    return {
      id: seedId(s.domain),
      name: s.name,
      domain: s.domain,
      plan: s.plan,
      status: s.status,
      health: s.health,
      seats: s.seats,
      seatsUsed: s.seatsUsed,
      mrrCents: mrrFor(s),
      usage: s.usage,
      owner: {
        name: s.owner,
        email: `${s.owner.split(' ')[0].toLowerCase()}@${s.domain}`,
      },
      createdAt,
      updatedAt,
      churnedAt,
    } satisfies Customer;
  });
}

let customers: Customer[] = seed();

const ok = <T>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status });
const notFound = () =>
  HttpResponse.json({ success: false, message: 'Customer not found' }, { status: 404 });

export const customerHandlers = [
  http.get('/api/customers', () => ok(customers)),

  http.get('/api/customers/:id', ({ params }) => {
    const customer = customers.find((c) => c.id === params.id);
    return customer ? ok(customer) : notFound();
  }),

  http.post('/api/customers', async ({ request }) => {
    const body = (await request.json()) as CreateCustomerDto;
    const iso = new Date().toISOString();
    const plan = body.plan ?? 'free';
    const seats = body.seats ?? 1;
    const customer: Customer = {
      id: uuid(),
      name: body.name,
      domain: body.domain,
      plan,
      // A new account starts its trial; nothing has been billed yet.
      status: 'trialing',
      health: 'healthy',
      seats,
      seatsUsed: 1,
      mrrCents: plan === 'enterprise' ? 0 : seats * PLAN_PRICE_CENTS[plan],
      usage: 0,
      owner: { name: body.name, email: `owner@${body.domain}` },
      createdAt: iso,
      updatedAt: iso,
      churnedAt: null,
    };
    customers = [customer, ...customers];
    return ok(customer, 201);
  }),

  http.patch('/api/customers/:id', async ({ params, request }) => {
    const body = (await request.json()) as UpdateCustomerDto;
    const idx = customers.findIndex((c) => c.id === params.id);
    if (idx === -1) return notFound();
    const next: Customer = { ...customers[idx], ...body, updatedAt: new Date().toISOString() };
    // Seats and plan both move the price, so recompute rather than trusting the
    // caller to send a consistent pair. Churn zeroes it and stamps the date,
    // which is what keeps the dashboard's historical MRR truthful.
    if (next.status === 'churned') {
      next.mrrCents = 0;
      next.churnedAt = customers[idx].churnedAt ?? new Date().toISOString();
    } else if (next.plan !== 'enterprise') {
      next.mrrCents = next.seats * PLAN_PRICE_CENTS[next.plan];
      next.churnedAt = null;
    }
    customers[idx] = next;
    return ok(customers[idx]);
  }),

  http.delete('/api/customers/:id', ({ params }) => {
    const existed = customers.some((c) => c.id === params.id);
    if (!existed) return notFound();
    customers = customers.filter((c) => c.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
