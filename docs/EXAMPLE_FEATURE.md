# Worked example: building the "Ping Log" feature

This walks through every step of [FEATURES.md](FEATURES.md) end-to-end against a
new `/api/ping` mock route. Copy it, swap in your own endpoint + page, and you
have a real feature.

The example builds a **Ping Log** page: visit `/ping`, press "Ping", the app
calls `GET /api/ping`, and the server's timestamp is prepended to a list.

Layers exercised:

- Types: a local `PingEntry`.
- Mock backend: a new `/api/ping` handler with seeded Faker latency.
- Service: a `pingService.ping()` wrapping the Axios client.
- Server state: a TanStack Query `useMutation` that appends to a list.
- Page layout: **5a — container page**: `PageShell` with Mantine `Card` + `Button`.
- Route: a `createRoute` added to `router.tsx`.
- Test: a vitest spec that hits `/api/ping` through the MSW node server.

---

## Step 1 — Claim the slot

Edit [`feature_list.json`](../feature_list.json) — flip `feature-001` to
`in_progress` and write the verification command **before** coding.

```json
{
  "id": "feature-001",
  "priority": 3,
  "area": "ping",
  "title": "Ping Log page",
  "user_visible_behavior": "The /ping route shows a list of timestamps. Clicking 'Ping' appends a new entry from /api/ping.",
  "status": "in_progress",
  "verification": [
    "npm run type-check",
    "npm run lint",
    "npm run test"
  ],
  "evidence": []
}
```

## Step 2 — The type

A two-field record is enough; keep it next to the page since nothing else needs it.

```ts
// src/api/types/ping.types.ts
export interface PingEntry {
  serverTime: string; // ISO 8601 from the server
  receivedAt: string; // ISO 8601 when the client got it
}
```

Re-export it (so `@/api/types` resolves it):

```ts
// src/api/types/index.ts — add:
export * from './ping.types';
```

## Step 3 — The mock route

```ts
// src/mocks/handlers/pingHandlers.ts
import { http, HttpResponse, delay } from 'msw';

export const pingHandlers = [
  http.get('/api/ping', async () => {
    await delay(300); // make the loading state visible
    return HttpResponse.json({
      success: true,
      data: { serverTime: new Date().toISOString() },
    });
  }),
];
```

Register it:

```ts
// src/mocks/handlers/index.ts
import { todoHandlers } from './todoHandlers';
import { pingHandlers } from './pingHandlers';

export const handlers = [...todoHandlers, ...pingHandlers];
```

## Step 4 — The service

```ts
// src/api/services/pingService.ts
import apiClient, { extractData } from '../client';
import type { ApiResponse } from '../types';

export const pingService = {
  async ping(): Promise<{ serverTime: string }> {
    const res = await apiClient.get<ApiResponse<{ serverTime: string }>>('/ping');
    return extractData(res);
  },
};
```

## Step 5 — The query hook

A ping is an action, so use `useMutation`:

```ts
// src/hooks/usePing.ts
import { useMutation } from '@tanstack/react-query';
import { pingService } from '@/api/services/pingService';

export function usePing() {
  return useMutation({ mutationFn: () => pingService.ping() });
}
```

## Step 6 — The page

```tsx
// src/pages/PingLog.tsx
import { useState } from 'react';
import { Button, Card, Stack, Text } from '@mantine/core';

import type { PingEntry } from '@/api/types';
import { EmptyState } from '@/components/empty-state';
import { PageShell } from '@/components/page-shell';
import { usePing } from '@/hooks/usePing';

export function PingLog() {
  const [entries, setEntries] = useState<PingEntry[]>([]);
  const ping = usePing();

  const handlePing = async () => {
    const { serverTime } = await ping.mutateAsync();
    setEntries((prev) => [{ serverTime, receivedAt: new Date().toISOString() }, ...prev]);
  };

  return (
    <PageShell
      archetype="list"
      title="Ping Log"
      description="Each click records a server timestamp."
      actions={
        <Button onClick={handlePing} loading={ping.isPending}>
          Ping
        </Button>
      }
    >
      {entries.length === 0 ? (
        <EmptyState title="No pings yet" description="Click “Ping” to record one." />
      ) : (
        <Stack gap="sm">
          {entries.map((e, i) => (
            <Card key={`${e.serverTime}-${i}`} withBorder radius="md" padding="md">
              <Text fw={600}>{new Date(e.serverTime).toLocaleTimeString()}</Text>
              <Text size="sm" c="dimmed">
                server: {e.serverTime}
              </Text>
            </Card>
          ))}
        </Stack>
      )}
    </PageShell>
  );
}
```

> `EmptyState` takes `title`, `description` and an optional `icon` — see
> [`src/components/empty-state.tsx`](../src/components/empty-state.tsx). Every
> other component here comes straight from `@mantine/core`; the choice of which
> one is in
> [`mantine-capabilities.md`](../.claude/skills/use-mantine/mantine-capabilities.md).

## Step 7 — The route

```tsx
// src/router/router.tsx
import { PingLog } from '@/pages/PingLog';

const pingRoute = createRoute({
  path: '/ping',
  component: PingLog,
  getParentRoute: () => rootRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  // …existing routes…
  pingRoute,
]);
```

Add a sidebar/nav link to `/ping` if the feature should be reachable from the
chrome (see `src/components/app-sidebar.tsx`).

## Step 8 — Verify and record evidence

```ts
// src/test/ping.test.ts
import { describe, it, expect } from 'vitest';
import '../mocks/node'; // server is started in src/test/setup.ts

describe('ping endpoint', () => {
  it('returns a server timestamp', async () => {
    const res = await fetch('/api/ping');
    const body = await res.json();
    expect(res.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(typeof body.data.serverTime).toBe('string');
  });
});
```

Run, in order:

```
npm run type-check   # Level 1
npm run lint         # Level 2
npm run test         # Level 3
```

When green, record evidence in `feature_list.json`:

```json
{
  "status": "passing",
  "evidence": [
    "src/test/ping.test.ts — returns a server timestamp",
    "Commit SHA: <fill in after commit>"
  ]
}
```

That's the full loop: type → mock → service → hook → page → route → test →
evidence. Every other feature follows the same path.
