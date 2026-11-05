import type { Meta, StoryObj } from '@storybook/react-vite';
import { delay, http, HttpResponse } from 'msw';

import { mswSession, withMemoryRouter } from '../../.storybook/tanstack-router-decorator';
import { Dashboard } from './Dashboard';

/**
 * Landing page after login: the MRR hero, four KPI tiles, the recurring-revenue
 * chart and the attention worklist — all derived from the single
 * `useCustomers()` query (served here by the real MSW handlers — same fixtures
 * as `npm run dev` with mocking on).
 */
const meta = {
  title: 'Pages/Dashboard',
  component: Dashboard,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  ...mswSession,
  decorators: [withMemoryRouter('/')],
} satisfies Meta<typeof Dashboard>;

export default meta;
type Story = StoryObj<typeof Dashboard>;

export const Populated: Story = {};

/** Empty backend — dashboard should degrade to empty states, not error. Worth
 *  keeping open: every derived figure has a zero-denominator branch, and this
 *  is the story that renders them. */
export const NoCustomers: Story = {
  beforeEach: ({ msw }) => {
    msw.use(http.get('/api/customers', () => HttpResponse.json({ success: true, data: [] })));
  },
};

/** Query in flight — stat cards and chart render their skeletons. */
export const Loading: Story = {
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/customers', async () => {
        await delay('infinite');
        return HttpResponse.json({ success: true, data: [] });
      }),
    );
  },
};

/** Backend 500 — the page must stay framed, not blank the shell. */
export const LoadError: Story = {
  name: 'Load error',
  beforeEach: ({ msw }) => {
    msw.use(
      http.get('/api/customers', () =>
        HttpResponse.json({ success: false, error: 'Upstream unavailable' }, { status: 500 }),
      ),
    );
  },
};
