import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, http, HttpResponse } from 'msw';

import { mswSession, withMemoryRouter } from '../../../.storybook/tanstack-router-decorator';
import { CustomerDetailPage } from './CustomerDetailPage';

/**
 * The fixture is pinned here rather than taken from the shared MSW handlers:
 * those seed ids are `crypto.randomUUID()`, so there is no stable URL to mount
 * a detail story at.
 */
const DEMO = {
  id: 'demo-1',
  name: 'Northwind Labs',
  domain: 'northwind.io',
  plan: 'enterprise',
  status: 'active',
  health: 'healthy',
  seats: 240,
  seatsUsed: 221,
  mrrCents: 1_240_000,
  usage: 88,
  owner: { name: 'Dana Whitfield', email: 'dana@northwind.io' },
  createdAt: new Date(Date.now() - 415 * 86_400_000).toISOString(),
  updatedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  churnedAt: null,
};

const detailHandler = http.get('/api/customers/:id', () =>
  HttpResponse.json({ success: true, data: DEMO })
);

/**
 * One account, on its own route — the app's `detail` archetype, and the only
 * page that exercises probe rule B5: one `h1` naming the subject, content in
 * declared sections, and a primary action that cannot scroll away.
 *
 * The route is a pattern (`/customers/$customerId`) and the location is a value
 * (`/customers/demo-1`); the decorator's third argument is what lets a story
 * carry both.
 */
const meta = {
  title: 'Pages/Customer',
  component: CustomerDetailPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  beforeEach: [mswSession.beforeEach, ({ msw }) => msw.use(detailHandler)],
  decorators: [withMemoryRouter('/customers/$customerId', {}, '/customers/demo-1')],
} satisfies Meta<typeof CustomerDetailPage>;

export default meta;
type Story = StoryObj<typeof CustomerDetailPage>;

export const Populated: Story = {};

/** An at-risk account on a per-seat plan — the other end of the health scale,
 *  and the state a CSM actually opens this page in. */
export const AtRisk: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/customers/:id', () =>
        HttpResponse.json({
          success: true,
          data: {
            ...DEMO,
            name: 'Fernpath Robotics',
            domain: 'fernpath.ai',
            plan: 'business',
            health: 'at_risk',
            seats: 28,
            seatsUsed: 9,
            mrrCents: 28 * 7900,
            usage: 18,
            owner: { name: 'Wen Li', email: 'wen@fernpath.ai' },
          },
        })
      )
    );
  },
};

/** Query in flight — the record renders its skeletons, not a blank route. */
export const Loading: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/customers/:id', async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: DEMO });
      })
    );
  },
};

/** A link to an account that is gone — arriving from an email months later is
 *  the normal way this happens, so it gets designed content and a way back. */
export const NotFound: Story = {
  name: 'Not found',
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/customers/:id', () =>
        HttpResponse.json({ success: false, message: 'Customer not found' }, { status: 404 })
      )
    );
  },
};
