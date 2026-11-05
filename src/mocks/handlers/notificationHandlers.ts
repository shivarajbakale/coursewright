/**
 * MSW handlers for notifications, shaped like the agent service's
 * `/api/notifications` (agent/app/api/notifications.py). In-memory, seeded on
 * first import; mark-read and mark-all-read last for the life of the page.
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
    kind: 'course_ready',
    title: 'Distributed Systems: consensus with Raft is ready',
    body: 'Chapters, diagrams and projects are written. Start with chapter 1.',
    href: '/courses/c-raft',
    courseId: 'c-raft',
    read: false,
    minutesAgo: 6,
  },
  {
    kind: 'review_ready',
    title: 'Review ready: A replicated key-value store, no failures yet',
    body: 'Feedback on your submission is in.',
    href: '/courses/c-raft/projects/p-1',
    courseId: 'c-raft',
    read: false,
    minutesAgo: 50,
  },
  {
    kind: 'course_failed',
    title: 'Build failed: How Postgres executes a query',
    body: 'The model returned no structured output for the outline. Start the build again from the Library.',
    href: '/',
    courseId: null,
    read: true,
    minutesAgo: 5 * hr / min,
  },
  {
    kind: 'source_failed',
    title: 'Couldn’t index raft.github.io/raft.pdf',
    body: 'HTTP 404 when fetching the page.',
    href: '/sources',
    courseId: null,
    read: true,
    minutesAgo: 2 * day / min,
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
    ok([...notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30))
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
