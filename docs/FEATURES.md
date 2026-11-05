# Building a feature

Hands-on guide for adding a new screen, wiring it into the app, and getting
it past the verification gate.

Companion reads:

- [BLUEPRINT.md](BLUEPRINT.md) — the upstream "describe the app → at-a-glance
  design → approve → features" flow. Feature work only starts once
  [`../BLUEPRINT.md`](../BLUEPRINT.md) is approved.
- [EXAMPLE_FEATURE.md](EXAMPLE_FEATURE.md) — every step of this guide run
  end-to-end against a new `/api/ping` mock. Read this first if you prefer
  learning from a worked example.
- [ARCHITECTURE.md](ARCHITECTURE.md) — directory map + allowed dependencies.
- [CONSTRAINTS.md](CONSTRAINTS.md) — rules around theme, dependencies, mocks.

## The 7-step recipe

1. Edit `feature_list.json` — claim the slot, write the verification command.
2. Add types under `src/api/types/` (or next to the page if local-only).
3. Add a mock handler under `src/mocks/handlers/` and register it.
4. Add a service under `src/api/services/`, then a query hook under `src/hooks/`.
5. Create the page under `src/pages/` (pick a layout below).
6. Register the route in `src/router/router.tsx`.
7. Add a test under `src/test/` (or a `.stories.tsx`), run `./init.sh`, record evidence.

Each step has a section below.

---

## 1. Claim the feature slot

Open [`feature_list.json`](../feature_list.json). Update **one** entry to
`status: "in_progress"` (only one entry may hold that status at a time).
Fill in `verification` with the exact command(s) you'll run, *before* you
start coding — see [AGENTS.md → Definition Of Done](../AGENTS.md#definition-of-done).

```json
{
  "id": "feature-001",
  "priority": 3,
  "area": "library",
  "title": "Library page lists saved articles",
  "user_visible_behavior": "The /library route shows a list of saved articles fetched from /api/articles.",
  "status": "in_progress",
  "verification": [
    "npm run type-check",
    "npm run lint",
    "npm run test"
  ],
  "evidence": []
}
```

If the work needs to grow, **edit the entry** and note the change in
[`DECISIONS.md`](../DECISIONS.md). Do not split or rewrite to hide
unfinished work.

---

## 2. Add types

Entities and DTOs go in `src/api/types/` and re-export from
`src/api/types/index.ts` (imported elsewhere as `@/api/types`). Mirror
[`todo.types.ts`](../src/api/types/todo.types.ts).

```ts
// src/api/types/article.types.ts
export interface Article {
  id: string;
  title: string;
  savedAt: string; // ISO 8601
}
```

```ts
// src/api/types/index.ts  — add the re-export
export * from './article.types';
```

---

## 3. Add a mock handler

The app boots with `VITE_ENABLE_MOCKING=true`, so a route needs a handler to
return data. Mirror [`todoHandlers.ts`](../src/mocks/handlers/todoHandlers.ts):
seed with Faker, return the `{ success, data }` envelope.

```ts
// src/mocks/handlers/articleHandlers.ts
import { http, HttpResponse } from 'msw';
import { faker } from '@faker-js/faker';
import _ from 'lodash';
import type { Article } from '@/api/types';

faker.seed(4242);
const articles: Article[] = _.times(8, () => ({
  id: faker.string.uuid(),
  title: faker.lorem.sentence(),
  savedAt: faker.date.recent().toISOString(),
}));

export const articleHandlers = [
  http.get('/api/articles', () =>
    HttpResponse.json({ success: true, data: articles })
  ),
];
```

Register it in [`src/mocks/handlers/index.ts`](../src/mocks/handlers/index.ts):

```ts
import { articleHandlers } from './articleHandlers';
export const handlers = [...todoHandlers, ...articleHandlers];
```

---

## 4. Add a service + query hook

**Service** — one object per resource, returns unwrapped data via
`extractData`. Mirror [`todoService.ts`](../src/api/services/todoService.ts):

```ts
// src/api/services/articleService.ts
import apiClient, { extractData } from '../client';
import type { Article, ApiResponse } from '../types';

export const articleService = {
  async list(): Promise<Article[]> {
    const res = await apiClient.get<ApiResponse<Article[]>>('/articles');
    return extractData(res);
  },
};
```

**Query hook** — wrap it in TanStack Query. Mirror
[`useTodosQuery.ts`](../src/hooks/useTodosQuery.ts):

```ts
// src/hooks/useArticlesQuery.ts
import { useQuery } from '@tanstack/react-query';
import { articleService } from '@/api/services/articleService';

export const articleKeys = { all: ['articles'] as const };

export function useArticles() {
  return useQuery({ queryKey: articleKeys.all, queryFn: () => articleService.list() });
}
```

For mutations, add a `useMutation` that calls the service and
`queryClient.invalidateQueries({ queryKey: articleKeys.all })` on success.

---

## 5. Create the page

File: `src/pages/<Feature>.tsx`, component `<Feature>`. Compose the screen out
of Mantine components imported directly from `@mantine/core`, and this
product's own composites from `@/components/...`; never invent layout that a
component already covers. The routing table for "which component" is
[`mantine-capabilities.md`](../.claude/skills/use-mantine/mantine-capabilities.md).

### Pick a page layout

**5a. Container page (default)** — `PageShell` with a title, a description and
content. Used by Dashboard and every list screen.

```tsx
// src/pages/Library.tsx
import { Card, SimpleGrid, Skeleton, Text } from '@mantine/core';

import { PageShell } from '@/components/page-shell';
import { useArticles } from '@/hooks/useArticlesQuery';

export function Library() {
  const { data: articles, isLoading } = useArticles();

  return (
    <PageShell archetype="list" title="Library" description="Your saved articles.">
      {isLoading ? (
        <Skeleton height={160} data-slot="skeleton" />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {articles?.map((a) => (
            <Card key={a.id} withBorder radius="md" padding="lg">
              <Text fw={600}>{a.title}</Text>
              <Text size="sm" c="dimmed" mt={4}>
                Saved {new Date(a.savedAt).toLocaleDateString()}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </PageShell>
  );
}
```

**5b. Detail page** — same shell, reads a route param via
`useParams({ from: '/things/$id' })` and a single-resource query hook. See
[`CustomerDetailPage`](../src/pages/Customers/CustomerDetailPage.tsx).

**5c. Form page** — React Hook Form + Zod over Mantine inputs; the `error` prop
carries the message, never a sibling element. Mirror
[`customer-form.tsx`](../src/pages/Customers/customer-form.tsx) and use the
`add-form` skill.

Default to 5a/5b. Reach for a bespoke layout only when a component doesn't fit.

### Layout building blocks

| Need                         | Reach for                                     |
| ---------------------------- | --------------------------------------------- |
| Page frame with title        | `PageShell` (`@/components/page-shell`)        |
| Raised surface               | `Paper withBorder` / `Card`, or `Panel`        |
| Primary action               | `Button`; `ActionIcon` when it is icon-only    |
| Text input / textarea        | `TextInput`, `Textarea`                        |
| Form with validation         | react-hook-form + zod over Mantine inputs      |
| Loading placeholder          | `Skeleton` (tag it `data-slot="skeleton"`)     |
| Empty list state             | `EmptyState` (`@/components/empty-state`)      |
| Sortable / filterable list   | `DataTable` (`@/components/data-table`)        |
| Modal confirmation           | `modals.openConfirmModal` (`@mantine/modals`)  |
| Transient confirmation       | `notify.*` from `src/lib/notify.ts`            |
| Tabs / static table          | `Tabs`, `Table`                                |

**Hard rules** (from [CONSTRAINTS.md](CONSTRAINTS.md)): no inline styles, no
hard-coded hex. Mantine owns colour, border, radius, elevation and layout —
`c="dimmed"`, `withBorder`, `radius="md"`, `shadow="md"`, `Group` / `Stack` /
`SimpleGrid` — and `make ui-lint` fails the build on a utility class. A new shared
component lives in `src/components/` once it is reused twice, with a sibling
`.stories.tsx`.

---

## 6. Register the route

Every navigable destination is a `createRoute` in
[`src/router/router.tsx`](../src/router/router.tsx) added to
`rootRoute.addChildren([...])`. Routing is manual and code-based — there is no
file-based routing and no `routeTree.gen.ts` — which keeps the whole navigation
surface in one greppable file. Routes render behind `AuthGuard` by default; for
a public page, follow the `/login` and `/signup` pattern.

```tsx
import { Library } from '@/pages/Library';

const libraryRoute = createRoute({
  path: '/library',
  component: Library,
  getParentRoute: () => rootRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  // …existing routes…
  libraryRoute,
]);
```

Navigate with `<Link to="/library">` or `useNavigate()({ to: '/library' })`.

---

## 7. Verify and record evidence

Add a test under `src/test/` that exercises the handler/hook via the MSW node
server (mirror [`example.test.ts`](../src/test/example.test.ts)), and/or a
`.stories.tsx` for a new component. Then run, in order:

```
npm run type-check   # Level 1
npm run lint         # Level 2 (max-warnings 0)
npm run test         # Level 3
```

When everything is green, record evidence in `feature_list.json`:

```json
{
  "status": "passing",
  "evidence": [
    "src/test/article.test.ts — lists articles from /api/articles",
    "Commit SHA: <fill in after commit>"
  ]
}
```

`passing → not_started` is forbidden. If a previously-passing feature
regresses, add a **new** feature entry for the regression rather than
silently flipping the status.

---

## Quick reference

| Concern               | File                                                 |
| --------------------- | ---------------------------------------------------- |
| New page              | `src/pages/<Feature>.tsx`                            |
| Route                 | `src/router/router.tsx`                              |
| Query hook            | `src/hooks/use<Feature>Query.ts`                     |
| Service               | `src/api/services/<feature>Service.ts`               |
| Types                 | `src/api/types/<feature>.types.ts` (+ `index.ts`)    |
| Mock handler          | `src/mocks/handlers/<feature>Handlers.ts` (+ `index.ts`) |
| UI state that survives navigation | a search param on the route, or a local hook |
| Shared component      | `src/components/<thing>.tsx` + `.stories.tsx`        |
| Feature tracker       | `feature_list.json`                                  |
| Session log           | `claude-progress.md`                                 |
| Architectural changes | `DECISIONS.md`                                       |
