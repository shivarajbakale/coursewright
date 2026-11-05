/**
 * MSW handlers for the Notifications resource.
 *
 * In-memory store seeded on first import. Mutations (mark-read, mark-all-read)
 * are persisted for the lifetime of the page. When a real API exists, delete
 * this file from the handler list — services/hooks/pages are unchanged.
 */
import { http, HttpResponse } from 'msw';
import type { Notification } from '@/api/types';

function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
}

const NOW = Date.now();
const min = 60_000;
const hr = 60 * min;
const day = 24 * hr;

type Seed = Omit<Notification, 'id' | 'createdAt'> & { minutesAgo: number };

const SEED: Seed[] = [
  {
    kind: 'mention',
    title: 'Priya mentioned you',
    body: '@you can you take a look at the Q3 plan?',
    actor: { name: 'Priya Raman' },
    read: false,
    minutesAgo: 8,
  },
  {
    kind: 'comment',
    title: 'New comment on "Billing v2"',
    body: '"Looks great — let’s ship it Friday."',
    actor: { name: 'Alex Lee' },
    read: false,
    minutesAgo: 42,
  },
  {
    kind: 'deploy',
    title: 'Deploy succeeded',
    body: 'Production build "v2.18.3" went live.',
    actor: { name: 'CI' },
    read: false,
    minutesAgo: 90,
  },
  {
    kind: 'invite',
    title: 'Jordan accepted your invite',
    body: 'They joined the workspace as a Member.',
    actor: { name: 'Jordan Kim' },
    read: true,
    minutesAgo: 6 * hr / min,
  },
  {
    kind: 'payment',
    title: 'Invoice INV-2026-0042 paid',
    body: 'Pro plan — monthly ($29.00).',
    read: true,
    minutesAgo: 1 * day / min,
  },
  {
    kind: 'system',
    title: 'New feature: bulk-archive projects',
    body: 'Select rows in Projects, hit Archive, done.',
    read: true,
    minutesAgo: 2 * day / min,
  },
  {
    kind: 'comment',
    title: 'New comment on "Design System"',
    body: '"Pushed the new tokens to /docs."',
    actor: { name: 'Mira Chen' },
    read: true,
    minutesAgo: 3 * day / min,
  },
  {
    kind: 'mention',
    title: 'Samira mentioned you',
    body: '@you the Figma file is ready for review.',
    actor: { name: 'Samira Patel' },
    read: true,
    minutesAgo: 4 * day / min,
  },
];

let notifications: Notification[] = SEED.map((s) => {
  const { minutesAgo, ...rest } = s;
  return {
    ...rest,
    id: uuid(),
    createdAt: new Date(NOW - minutesAgo * min).toISOString(),
  };
});

const ok = <T>(data: T, status = 200) =>
  HttpResponse.json({ success: true, data }, { status });

export const notificationHandlers = [
  http.get('/api/notifications', () =>
    ok([...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  ),

  http.patch('/api/notifications/:id', async ({ params, request }) => {
    const body = (await request.json()) as { read?: boolean };
    const idx = notifications.findIndex((n) => n.id === params.id);
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    notifications[idx] = { ...notifications[idx], ...body };
    return ok(notifications[idx]);
  }),

  http.post('/api/notifications/mark-all-read', () => {
    notifications = notifications.map((n) => ({ ...n, read: true }));
    return ok({ updated: notifications.length });
  }),
];
