---
name: auth-page
description: Build a premium, SaaS-grade auth screen (login, signup, forgot-password, invite-accept) using the shared split-screen AuthLayout. Use when the user wants to add or restyle an authentication page.
---

# auth-page — premium auth screens

Auth screens use a shared split-screen chrome so they look like a real SaaS
product: a dark brand panel on the left, a focused form column on the right.

## Reference

- Layout: `src/pages/Auth/AuthLayout.tsx` (brand panel + centered form column).
- Login: `src/pages/Auth/LoginPage.tsx` (form + `SocialButton` + divider).
- Signup: `src/pages/Auth/SignupPage.tsx`.
- Auth client: `src/lib/auth.ts` — `useSession`, `signIn`, `signUp`, `signOut`.
  In this starter it's a **local demo shim** (localStorage); swap it for a real
  provider keeping the same exports and every screen keeps working.

## Steps

1. Create `src/pages/Auth/<Name>Page.tsx` and wrap the content in `<AuthLayout>`.
2. Build the form with **react-hook-form + zod** (`zodResolver`), mirroring
   `LoginPage`. Show field errors under each input; show a top-level error box for
   submit failures.
3. Call the matching `@/lib/auth` method; on success `router.navigate({ to: '/' })`.
4. Reuse `SocialButton` (exported from `LoginPage`) for OAuth buttons.
5. Register a **public** route: add it in `src/router/router.tsx` and add its path
   to `PUBLIC_ROUTES` in `src/App.tsx` so it renders without the app chrome.

## Rules

- Tokens only — the brand panel's ground and its type come from Mantine's own
  variables (`var(--mantine-color-body)`, `c="dimmed"`) or from a `Paper` /
  `Box bg=` that resolves against the theme. No hard-coded colours, and no
  utility classes: this app has none.
- Keep the form column narrow (`maw={360}`) and the copy tight.

## Verify

`npm run type-check`, then `npm run dev`: visit the route, submit valid and
invalid input, and confirm the redirect + that it looks right in dark and light.

<!-- ux-prepass:v2 -- canonical 7-item checklist lives in `.claude/skills/ux-prepass/SKILL.md`. -->
See `ux-prepass` for the mandatory UI gates. Confirm every box before marking this task done.
