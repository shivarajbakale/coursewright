import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, http, HttpResponse } from 'msw';

import { mswSession, withMemoryRouter } from '../../../.storybook/tanstack-router-decorator';
import { CustomersPage } from './CustomersPage';

/**
 * The customer collection, full width — the app's `list` archetype, and what
 * probe rule B8 is measured against. A row is a link to
 * `/customers/$customerId`, so the record it opens is `Pages/Customer`.
 *
 * Data comes from the shared MSW handlers, so this story and `npm run dev`
 * show identical fixtures.
 */
const meta = {
  title: 'Pages/Customers',
  component: CustomersPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  ...mswSession,
  decorators: [withMemoryRouter('/customers')],
} satisfies Meta<typeof CustomersPage>;

export default meta;
type Story = StoryObj<typeof CustomersPage>;

export const Populated: Story = {};

export const Empty: Story = {
  beforeEach: ({ msw }) => {
    msw.use(http.get('/api/customers', () => HttpResponse.json({ success: true, data: [] })));
  },
};

/** Query in flight — the list rail shows its skeleton rows. */
export const Loading: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/customers', async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: [] });
      })
    );
  },
};

/** Backend 500 — the page frame and its filters survive; only the table reports. */
export const LoadError: Story = {
  name: 'Load error',
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/customers', () =>
        HttpResponse.json({ success: false, error: 'Upstream unavailable' }, { status: 500 })
      )
    );
  },
};
