/**
 * MSW handlers for the Team resource.
 *
 * Seeded with eight realistic members spanning every role. Mutations
 * (invite, role-change, remove) are in-memory only — fine for the starter.
 */
import { http, HttpResponse } from 'msw';
import type { Member, InviteMemberDto, WorkspaceRole, WorkspaceSeats } from '@/api/types';

function uuid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
}

const NOW = Date.now();
const day = 86_400_000;

const SEED: Member[] = [
  {
    id: uuid(),
    name: 'You (Owner)',
    email: 'you@example.com',
    role: 'owner',
    status: 'active',
    team: 'Founding',
    joinedAt: new Date(NOW - 365 * day).toISOString(),
    lastActiveAt: new Date(NOW - 60_000).toISOString(),
  },
  {
    id: uuid(),
    name: 'Priya Raman',
    email: 'priya@example.com',
    role: 'admin',
    status: 'active',
    team: 'Engineering',
    joinedAt: new Date(NOW - 220 * day).toISOString(),
    lastActiveAt: new Date(NOW - 5 * 60_000).toISOString(),
  },
  {
    id: uuid(),
    name: 'Alex Lee',
    email: 'alex@example.com',
    role: 'member',
    status: 'active',
    team: 'Engineering',
    joinedAt: new Date(NOW - 180 * day).toISOString(),
    lastActiveAt: new Date(NOW - 30 * 60_000).toISOString(),
  },
  {
    id: uuid(),
    name: 'Mira Chen',
    email: 'mira@example.com',
    role: 'member',
    status: 'active',
    team: 'Design',
    joinedAt: new Date(NOW - 150 * day).toISOString(),
    lastActiveAt: new Date(NOW - 2 * 3_600_000).toISOString(),
  },
  {
    id: uuid(),
    name: 'Samira Patel',
    email: 'samira@example.com',
    role: 'member',
    status: 'active',
    team: 'Design',
    joinedAt: new Date(NOW - 90 * day).toISOString(),
    lastActiveAt: new Date(NOW - 22 * 3_600_000).toISOString(),
  },
  {
    id: uuid(),
    name: 'Jordan Kim',
    email: 'jordan@example.com',
    role: 'viewer',
    status: 'active',
    team: 'Marketing',
    joinedAt: new Date(NOW - 14 * day).toISOString(),
    lastActiveAt: new Date(NOW - 6 * 3_600_000).toISOString(),
  },
  {
    id: uuid(),
    name: 'Noah Williams',
    email: 'noah@example.com',
    role: 'member',
    status: 'invited',
    team: 'Engineering',
    joinedAt: new Date(NOW - 1 * day).toISOString(),
  },
  {
    id: uuid(),
    name: 'Yuki Tanaka',
    email: 'yuki@example.com',
    role: 'admin',
    status: 'disabled',
    team: 'Operations',
    joinedAt: new Date(NOW - 300 * day).toISOString(),
    lastActiveAt: new Date(NOW - 30 * day).toISOString(),
  },
];

let members: Member[] = [...SEED];

const ok = <T>(data: T, status = 200) =>
  HttpResponse.json({ success: true, data }, { status });

function seats(): WorkspaceSeats {
  const used = members.filter((m) => m.status !== 'disabled').length;
  return { used, total: 25, plan: 'pro' };
}

export const teamHandlers = [
  http.get('/api/team', () => ok(members)),
  http.get('/api/team/seats', () => ok(seats())),

  http.post('/api/team/invite', async ({ request }) => {
    const body = (await request.json()) as InviteMemberDto;
    const member: Member = {
      id: uuid(),
      name: body.email.split('@')[0].replace(/\W+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      email: body.email,
      role: body.role,
      status: 'invited',
      team: body.team,
      joinedAt: new Date().toISOString(),
    };
    members = [member, ...members];
    return ok(member, 201);
  }),

  http.patch('/api/team/:id', async ({ params, request }) => {
    const body = (await request.json()) as { role?: WorkspaceRole; status?: Member['status'] };
    const idx = members.findIndex((m) => m.id === params.id);
    if (idx === -1) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    members[idx] = { ...members[idx], ...body };
    return ok(members[idx]);
  }),

  http.delete('/api/team/:id', ({ params }) => {
    const existed = members.some((m) => m.id === params.id);
    if (!existed) return HttpResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    members = members.filter((m) => m.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
