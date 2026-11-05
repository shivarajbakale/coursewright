---
name: add-api-endpoint
description: Add a single API call (service method + matching MSW mock + query/mutation hook) so the frontend stays runnable with no backend. Use when the user wants one new endpoint or action on an existing resource (e.g. "suspend a customer", "fetch stats", "invite a member").
---

# add-api-endpoint — one endpoint, mock included

Keep the three layers in lockstep so the app runs standalone (MSW) and against a
real API without code changes. Reference: the Customers slice.

## The three edits

1. **Service method** — add to the resource's service (e.g.
   `src/api/services/customerService.ts`). Use `apiClient` + `extractData`; return
   the unwrapped domain type. Example:
   ```ts
   async suspend(id: string): Promise<Customer> {
     const res = await apiClient.post<ApiResponse<Customer>>(`/customers/${id}/suspend`, {});
     return extractData(res);
   }
   ```
2. **MSW handler** — add a matching handler in the resource's handler file (e.g.
   `src/mocks/handlers/customerHandlers.ts`) so the endpoint works with no backend.
   Return the `{ success, data }` envelope with the right status.
3. **Query/mutation hook** — add to the resource's hooks (e.g.
   `src/hooks/useCustomers.ts`). Mutations invalidate via the `xKeys` factory and
   raise a `sonner` toast on success/error, matching the existing hooks.

## Rules

- Endpoint paths are relative and start with `/api` implicitly (axios `baseURL`
  is `/api`; MSW handlers match `/api/...`).
- Reuse the `ApiResponse<T>` envelope from `src/api/types/api.types.ts`.
- Never call the service directly from a component — always go through a hook.

## Verify

`npm run type-check`; add/extend a test in `src/test/` that exercises the new
handler; drive it in the UI with `npm run dev`. If the mutation changes
anything the user sees (toast, badge, list state), also run the seven items in
the `ux-prepass` skill.
