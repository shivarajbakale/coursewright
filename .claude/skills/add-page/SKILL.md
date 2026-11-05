---
name: add-page
description: Add a new routed page and wire it into the router, sidebar, and ⌘K command palette. Use when the user wants a standalone page/screen/tab that isn't a full CRUD resource (e.g. Billing, Reports, Team, an overview screen).
---

# add-page — add a routed screen

Use this for a page that isn't a full data resource (for that, use `add-feature`).

## Step 0a — plan it, if the screen isn't already specified

`plan-feature` renders the layout, the four states, and the control choices as
a reviewable `FEATURE-PLAN.md` before anything is written. Its `archetype`
becomes this page's `PageShell archetype` prop — one of the seven in
[`docs/principles/screen-archetypes.md`](../../../docs/principles/screen-archetypes.md),
which is where you decide *which*. Skip only when the user has already described
the screen precisely.

Whichever route you take, the page must declare an archetype: an undeclared page
is one no Module B rule can reach, and `src/test/declarations.test.tsx` fails on
it.

## Step 0 — scan the design system (do this BEFORE writing a line)

Hand-rolling a component Mantine or this app already ships is the single most
common way this UI drifts out of theme. The lint catches raw `<button>` /
`<table>` / `<input>` and the obvious hand-rolled card / badge / progress
patterns, but it cannot tell that your locally-defined `function StatCard`
duplicates the composite at `src/components/stat-card.tsx`. So you do it by
hand.

**Run the scan once, before you start, and paste the relevant matches next to
your `import` block:**

```bash
# The app's own composites — the ones with an opinion Mantine does not hold
ls src/components/*.tsx | grep -v stories
```

Everything else is Mantine: `Card`, `Badge`, `Button`, `TextInput`, `Progress`,
`Skeleton`, `Avatar`, `Tabs`, `SegmentedControl`, `Table`, and the packages
beside it for charts, dates and the palette.

For each thing your page needs, write a one-line decision before you write
the JSX:

| This page needs… | …and the kit already has | So I'll… |
|---|---|---|
| A section card with a header band | `Panel` (`src/components/panel.tsx`) | use Panel |
| A KPI tile (label / value / icon / sparkline / delta) | `StatCard` (`src/components/stat-card.tsx`) | use StatCard |
| A zero-data state | `EmptyState` from `@mantine/core` | use EmptyState |
| A row with avatar + name + email + actions | `MemberRow` (in `TeamPage.tsx`) — molecule on top of `Table` | use MemberRow or extract |
| An empty-state copy + a CTA button | `EmptyState` accepts `children` for the CTA | pass CTA as children, not `action` prop |

If the scan surfaces a gap, extend the existing composite rather than writing a
parallel implementation. Example: when TeamPage needed a "progress bar below the
value" slot, the right move was to add a `progress?: number` prop to `StatCard`,
not to define a new StatCard locally.

## Step 1 — create the page

Create `src/pages/<Name>.tsx`. Start from the shape of `src/pages/Settings.tsx`:

- Wrap everything in `<PageShell title="…" description="…" actions={…}>`
  from `@/components/page-shell`. It pins the title band and owns the page's
  single scroll region. Pass `scroll={false}` only when the page manages its
  own panes, as `CustomersPage` does.
- **Never add `overflow-y-auto`.** The shell is a fixed viewport
  (`src/App.tsx`), and `make check` in the generating repo fails a build that
  breaks that contract. Use `ScrollArea` if you need a scrollable list.
- If the page has more than two sections, prefer `Tabs` or a sidebar rail
  over stacking them — see `src/pages/Settings.tsx`. Long stacked pages are
  what the layout contract exists to prevent.
- **Section cards**: use `<Panel title="…" description="…">` for every section
  that needs a header band, rather than assembling a `Paper withBorder` with a
  hand-built header row and a `Divider` under it. Panel encapsulates that
  pattern, and it is the one place the raised surface is defined.
- **KPI tiles**: use `<StatCard label value icon progress />`. The composite
  supports sparkline (`series`), delta arrow (`delta`), loading state
  (`loading`), and progress bar (`progress`) — extend it rather than wrapping
  it if you need a new slot.
- **Colour is Mantine's, and so is layout.** Pass `c`, `bg`, `color`, `variant`
  or a theme custom property — never a hex and never a utility class. Rows are
  `Group`, columns are `Stack`, grids are `SimpleGrid` / `Grid`, and anything
  else is `Box` with a style object. `ui-lint` enforces it.
- **For lists**: use `DataTable` (`src/components/data-table.tsx`), or Mantine's
  `Table` for a static one. For row-action menus, Mantine `Menu`. For status
  pills, `Badge` with a `color` and `variant="light"`.

### Anti-pattern: text bleeds outside card chrome

The single most expensive UI bug we shipped: a page wrapper parked `<p>` text
**outside** the card and used `-mt-2` to overlap the card's bottom
border. Screenshots looked fine; the bug only surfaced via a manual DOM
inspection that showed text's measured box extending 12px past the card's
bottom edge with no card chrome around the hanging pixels.

**The ui-probe rule `T1` (enforced) catches this.** It walks every card in
the page and asserts every text-bearing descendant's bounding box is inside
the card's box. The rule fires with a 1px tolerance for sub-pixel rendering,
skips `ScrollArea` descendants (tables that legitimately scroll), and can
be opted out per-element with `data-probe-ignore="T1"`.

**Three rules to avoid it:**
1. **Never put a `<p>` (or any text node) outside the card that's
   supposed to describe the card's contents.** The wrapping element that owns
   the text needs card chrome around it too. If you don't want a new card,
   use the component's built-in slot (`<StatCard sub="...">` puts the text
   inside; `<Panel description="...">` puts it in the header).
2. **No `-mt-N` or `-mb-N` on text elements that visually abut a card.**
   Negative margins to overlap a sibling's border are a band-aid that hides
   the bug from the eye but not from the box model. If the spacing feels
   wrong, restructure the card boundary, not the margin.
3. **If you must opt out of `T1`, set `data-probe-ignore="T1"` on the
   specific element AND leave a one-line comment explaining why** (e.g.
   `// animated entry — bleeds during transition`). Don't opt out the whole
   page.

## Step 2 — register the route

In `src/router/router.tsx`: add a `createRoute({ path, component,
getParentRoute: () => rootRoute })` and include it in
`rootRoute.addChildren([...])`. If the page should be 404-handled (i.e. it
fills the "not found" gap), also add `notFoundComponent: <Name>` to the
`rootRoute`.

## Step 3 — add navigation

In `src/config/nav.ts`: push an entry to `navItems` with a `lucide-react` icon.
This lights up the sidebar link **and** the ⌘K palette, and the topbar page
title (`pageTitleFor`).

## Step 4 — public vs. protected

If the page should be **public** (no auth), add its path to `PUBLIC_ROUTES`
in `src/App.tsx`. Otherwise leave it protected — `AuthGuard` handles the rest.

## Step 5 — give the page an entrance

There is **no route-transition wrapper**, on purpose — one covering the whole
viewport is what makes an app look like it flickers on every navigation, and
`docs/principles/motion.md` records the two attempts. The router unmounts the
old page and mounts yours, so your page's own entrance *is* the route
transition.

That entrance is two components, not a prop on nineteen elements:

- Wrap each top-level block in `<Reveal>` (`src/components/reveal.tsx`). A
  second block that should follow the first takes `delay={0.12}`.
- A row of tiles or a list of sections is `<Stagger>` with a `<StaggerItem>`
  per child — the sequencing lives on the parent and propagates down the React
  tree, so column `div`s in between do not break it.
- **One** figure per screen may count up, through `<AnimatedNumber>`. It is an
  emphasis device; on every number it says nothing.

Never write a bare `motion.div` in a page, never write a duration or an easing
as a literal (`ui-lint` fails both), and never pass `initial={false}` to an
`AnimatePresence` — it suppresses the entrance of everything below it, not just
its own. The reasoning is in
[`docs/principles/motion.md`](../../../docs/principles/motion.md); the gate is
Module M of the UI probe, and **M4 fails a page where nothing moved at all**.

## Verify

`make check` exits 0 (tsc + ui-lint + a11y + test + ui-probe), then `npm run
dev` and confirm the sidebar link + ⌘K entry navigate to the page and the
topbar shows its title.

The most common failure at this step is `make ui-lint` flagging a raw element
or hand-rolled card / badge / progress. Fix it by switching to the Mantine
component — the lint message names it.

<!-- ux-prepass:v2 -- canonical 7-item checklist lives in `.claude/skills/ux-prepass/SKILL.md`. -->
See `ux-prepass` for the mandatory UI gates. Confirm every box before marking this task done.
