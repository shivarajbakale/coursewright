import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/node';
import type { Customer } from '@/api/types';

/**
 * Reference test for the Customers slice.
 *
 * Shows the pattern the `add-feature` skill follows: exercise a resource through
 * its MSW handlers (the same ones the app uses), and override a handler to test
 * a failure path.
 *
 * The handlers use relative paths (e.g. `/api/customers`) so MSW resolves them
 * against the current origin — exactly as in the browser. Under jsdom (this
 * project's test environment) that origin is `location.origin`, so we build
 * request URLs from it to guarantee handler and request agree.
 */
const api = (path: string) => `${location.origin}${path}`;

describe('Customers API (MSW handlers)', () => {
  it('lists customers', async () => {
    const res = await fetch(api('/api/customers'));
    const body = await res.json();

    expect(res.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('creates then fetches a customer', async () => {
    const create = await fetch(api('/api/customers'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Account', domain: 'testaccount.com', plan: 'pro', seats: 4 }),
    });
    const created = (await create.json()).data as Customer;

    expect(create.status).toBe(201);
    expect(created.name).toBe('Test Account');
    expect(created.status).toBe('trialing');
    // Price is derived from the plan and the seat count, not sent by the
    // client — a caller that could post its own MRR could post any number, and
    // the dashboard sums this field.
    expect(created.mrrCents).toBe(4 * 2900);

    const get = await fetch(api(`/api/customers/${created.id}`));
    const fetched = (await get.json()).data as Customer;
    expect(fetched.id).toBe(created.id);
  });

  it('recomputes MRR when the seat count changes', async () => {
    const list = await fetch(api('/api/customers'));
    const all = (await list.json()).data as Customer[];
    // A live per-seat account, chosen explicitly: enterprise is contracted
    // rather than per-seat and a churned account bills nothing, so picking
    // whatever happens to be first would make this test pass by not asserting.
    const target = all.find((c) => c.plan === 'pro' && c.status === 'active');
    expect(target, 'fixture should contain an active pro account').toBeDefined();

    const res = await fetch(api(`/api/customers/${target!.id}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seats: target!.seats + 1 }),
    });
    const updated = (await res.json()).data as Customer;

    expect(res.ok).toBe(true);
    expect(updated.seats).toBe(target!.seats + 1);
    // The handler prices the subscription rather than trusting the patch — a
    // caller that could post its own MRR could post any number, and the
    // dashboard sums this field.
    expect(updated.mrrCents).toBe((target!.seats + 1) * 2900);
  });

  it('returns 404 for a missing customer', async () => {
    const res = await fetch(api('/api/customers/does-not-exist'));
    expect(res.status).toBe(404);
  });

  it('surfaces server errors (handler override)', async () => {
    server.use(
      http.get('/api/customers', () =>
        HttpResponse.json({ success: false, message: 'boom' }, { status: 500 })
      )
    );
    const res = await fetch(api('/api/customers'));
    expect(res.status).toBe(500);
  });
});
