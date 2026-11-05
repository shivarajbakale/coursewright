import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CustomersPage } from '@/pages/Customers/CustomersPage';
import { CustomerDetailPage } from '@/pages/Customers/CustomerDetailPage';
import { renderCustomers } from './render';

/**
 * The layout contract, asserted at runtime.
 *
 * `scripts/ui-lint.mjs` in the generating repo catches hand-rolled markup
 * statically; these tests cover the behaviour that lint cannot see — that a row
 * is a link to the member's own route, that the detail route is reachable
 * directly (which is the whole reason it is a route), and that the page header
 * stays put instead of scrolling away.
 */
describe('Customers list', () => {
  it('renders the collection from the mock API', async () => {
    renderCustomers(CustomersPage);

    expect(await screen.findByText('Northwind Labs')).toBeInTheDocument();
    expect(screen.getByText('Halcyon Freight')).toBeInTheDocument();
  });

  it('sends a row click to that account’s own route', async () => {
    const user = userEvent.setup();
    const { router } = renderCustomers(CustomersPage);

    const res = await fetch(`${location.origin}/api/customers`);
    const all = (await res.json()).data as { id: string; name: string }[];
    const northwind = all.find((c) => c.name === 'Northwind Labs')!;

    await user.click(await screen.findByText('Northwind Labs'));

    // The list is a collection you leave. Selecting a row navigates rather than
    // filling a second pane, and the URL carries *that* account — the id the
    // API gave for the row that was clicked, not just some id — so the page can
    // be linked to, bookmarked and reloaded.
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/customers/${northwind.id}`)
    );
  });

  it('keeps the page header outside the scroll region', async () => {
    renderCustomers(CustomersPage);

    const heading = await screen.findByRole('heading', { name: 'Customers', level: 1 });

    // The header must not live inside the page's scroll viewport — if it does, it
    // scrolls away with the content and the shell's fixed-viewport contract is
    // broken.
    expect(heading.closest('[data-slot="scroll-area-viewport"]')).toBeNull();
  });

  it('filters the list without a page reload', async () => {
    renderCustomers(CustomersPage);

    await screen.findByText('Northwind Labs');

    // `fireEvent` rather than `userEvent` here: under jsdom every
    // getBoundingClientRect is a zero rect at the origin, so pointer-driven
    // libraries in the tree can swallow focus. Change events are what the
    // filter actually listens to.
    fireEvent.change(screen.getByPlaceholderText('Filter by name, domain, plan…'), {
      target: { value: 'Halcyon' },
    });

    await waitFor(() => expect(screen.queryByText('Northwind Labs')).not.toBeInTheDocument());
    expect(screen.getByText('Halcyon Freight')).toBeInTheDocument();
  });

  it('adds a customer from the dialog, not a separate page', async () => {
    const user = userEvent.setup();
    const { router } = renderCustomers(CustomersPage);

    await screen.findByText('Northwind Labs');
    await user.click(screen.getByRole('button', { name: /new customer/i }));

    const dialog = await screen.findByRole('dialog');

    // `fireEvent.change` rather than `user.type` for the fields: Mantine's
    // Modal wraps its body in a FocusTrap, and under jsdom the trap wins the
    // race against userEvent's click-then-type, so every keystroke lands back
    // in the `data-autofocus` field and the second field stays empty. The
    // click on the submit button is still userEvent — that part behaves.
    fireEvent.change(within(dialog).getByLabelText('Account name'), {
      target: { value: 'Test Account' },
    });
    fireEvent.change(within(dialog).getByLabelText('Domain'), {
      target: { value: 'testaccount.com' },
    });
    await user.click(within(dialog).getByRole('button', { name: /add customer/i }));

    // Creation is a dialog over the list; what follows it is the new account's
    // route, so the user lands on the thing they just made.
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/customers\/.+/));
  });
});

describe('Customer detail', () => {
  /** A real id from the same MSW collection the page reads. */
  const firstCustomer = async () => {
    const res = await fetch(`${location.origin}/api/customers`);
    const [first] = (await res.json()).data as { id: string; name: string }[];
    return first;
  };

  it('opens cold from a URL — nobody arriving from a link saw the list', async () => {
    const first = await firstCustomer();
    renderCustomers(CustomerDetailPage, `/customers/${first.id}`);

    // The h1 is the subject's name, not the category. A detail page that opens
    // on "Customer" has spent its headline on what the nav rail already said.
    expect(
      await screen.findByRole('heading', { name: first.name, level: 1 })
    ).toBeInTheDocument();
  });

  it('declares the sections and the single primary action that rule B5 counts', async () => {
    const first = await firstCustomer();
    const { container } = renderCustomers(CustomerDetailPage, `/customers/${first.id}`);
    await screen.findByRole('heading', { name: first.name, level: 1 });

    // The probe checks this in a real browser; this is the jsdom half of the
    // same contract, so a section that loses its declaration fails here first.
    expect(container.querySelectorAll('[data-section]').length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll('[data-primary-action]')).toHaveLength(1);
  });

  it('gives a dead link a designed state and a way back', async () => {
    renderCustomers(CustomerDetailPage, '/customers/does-not-exist');

    expect(
      await screen.findByRole('heading', { name: 'Customer not found', level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to customers/i })).toBeInTheDocument();
  });
});
