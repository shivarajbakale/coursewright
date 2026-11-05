# Constraints

Required reading before adding a dependency or changing theme tokens.

## Dependencies (`package.json`)

MUST be true of any new dependency:

- Pinned to a `^` minor version, not `*` or `latest`.
- Justified in `DECISIONS.md` (what problem it solves, what was rejected).
- Maintained — last release within ~12 months, not deprecated.
- Compatible with the toolchain (`npm run type-check`, `npm run lint`, and
  `npm run build` must still pass).

MUST NOT:

- Add a dependency for a one-off helper that fits in `src/lib/` in < 50 lines.
- Add a state-management or data-fetching library. The standards are
  **TanStack Query** for server state and **React Hook Form** for form state;
  UI state lives in local hooks and the router. There is no global store and no
  `src/stores/` — adding one is a `DECISIONS.md`-level decision.
- Add a second component/UI kit. Mantine is the design system; a new primitive
  is a Mantine component configured through `src/theme.ts`, and a new
  product-level piece is a composite in `src/components/`.
- Wire a real auth provider without a `DECISIONS.md` entry. `src/lib/auth.ts`
  is a deliberate local demo shim so the app boots with no backend; replacing it
  is a real decision, and it must keep the same exports.

## Data fetching, forms & auth

MUST:

- Fetch and mutate server data through **TanStack Query** hooks
  (`src/hooks/`) backed by the **Axios service layer** (`src/api/services/`).
  Never call `fetch`/`axios` from a component or use `useEffect` for fetching.
- Validate forms with **React Hook Form + Zod** (`zodResolver`).
- Read auth state with `useSession()` and gate protected screens behind
  `AuthGuard` (`src/components/auth/AuthGuard.tsx`). Sign-in, sign-up and
  sign-out go through `@/lib/auth`, which is the demo shim — never talk to a
  session endpoint directly, or swapping the shim stops being a one-file change.
- Generate mock data with **Faker.js** (seeded) — never hand-write mock arrays.

## Styling / theme tokens

MUST be true of any styling change:

- Say it with a Mantine prop. Colour is `c` / `bg` / `color`, spacing is
  `p` / `m` / `gap`, and layout is `Group` / `Stack` / `SimpleGrid` / `Grid` /
  `Box` — not a `<div>` with a class on it.
- Use theme values (`c="dimmed"`, `radius="md"`, `shadow="md"`, or a
  `--mantine-color-*` variable) — never a raw hex or an arbitrary colour. The
  palette is retuned in `src/theme.ts`.
- Respect dark mode — every theme value resolves per scheme, and `light-dark()`
  is available in CSS for the rest.

MUST NOT:

- Hard-code a hex color (`#3b82f6`) in a component. Retune the theme instead.
- Fork a Mantine component to restyle it. Configure it in `src/theme.ts`
  (`defaultProps`, `styles`, `classNames`) so every instance moves together.
- Write a utility class of any kind. There is one styling system: Mantine owns
  colour, border, radius, elevation *and* layout, and `ui-lint`'s boundary rule
  fails a `className` string that looks like a utility anywhere in `src/` or
  `.storybook/`. What an inline style genuinely cannot express — a media query,
  say — goes in a CSS module beside its component.

## Design system (Mantine + `src/components/`)

MUST be true of any new UI component:

- Reach for `@mantine/core` first — and `@mantine/dates`, `@mantine/charts`,
  `@mantine/carousel`, `@mantine/spotlight`, `@mantine/notifications` for the
  rest. A component this repo does not own is a component it cannot break.
- A composite this product does own lives flat in `src/components/`, with a
  sibling `.stories.tsx` and an entry in `docs/storybook-taxonomy.json`.
- Recurring configuration goes in `src/theme.ts`, not in a wrapper component.
- No dependency on pages, hooks, or the api layer.

## Mock backend (`src/mocks/`)

MUST be true of any mock-route addition:

- Handler added under `src/mocks/handlers/` and spread into
  `src/mocks/handlers/index.ts`.
- Response shape matches the `{ success, data }` / `{ success, data: { data,
  pagination } }` envelope the services expect (see `todoHandlers.ts`).
- Realistic data via seeded Faker.js.

## Verification

MUST be true at the end of every session:

- `npm run type-check` reports no errors.
- `npm run lint` reports no errors and no warnings (runs with `--max-warnings 0`).
- `npm run test` passes.
- `./init.sh` exits 0 on a fresh shell.

## Design System Usage

<!-- ux-layer:v1 -->

Mantine's components are the ONLY approved way to build UI. Hand-rolling a raw
element that one of them already covers fails lint and code review.

### Raw element -> component mapping

| Raw element | Use instead |
| --- | --- |
| `<button>` | `Button`, `ActionIcon` or `UnstyledButton` — `@mantine/core` |
| `<input>` | `TextInput` (or `Checkbox` / `Radio` / `Switch`) |
| `<textarea>` | `Textarea` |
| `<select>` | `Select` |
| `<table>` | `Table`, or the `DataTable` composite for sorting and filtering |

### Colors are tokens only

Use semantic tokens (`primary`, `muted`, `destructive`, ...) — never raw
hex/rgb values in components. Theme changes must work without touching app code.

### Do / Don't

```tsx
// DO — variant + size carry the styling
<Button variant="outline" size="sm">Cancel</Button>

// DON'T — hand-rolled styling duplicates the atom
<button className="rounded-md border px-3 ...">Cancel</button>
```

