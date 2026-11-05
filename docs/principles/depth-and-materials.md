<!-- principle:depth-and-materials:v1 -->
<!-- Stamped from the shared principles source by stamp-principles.mjs. Edit the source and re-stamp: a hand edit fails principles-drift. -->

# Depth and Materials

Which surface sits above which, and what it costs to say so.

## The failure this prevents

**Elevation chosen one component at a time.** Mantine ships a five-step shadow
scale (`xs` → `xl`) and every surface component takes a `shadow` prop, so
nothing stops a page from giving a card `shadow="lg"` and the menu that opens
over it `shadow="sm"`. That is not a depth system; it is a set of independent
decisions that happen to coexist, and the result is a dropdown that floats
lower than the card beneath it.

The second failure is **depth doing a job that colour already did.** A card on a
page needs to read as a distinct surface. It gets a background *and* a border
*and* a shadow, and the shadow is the one carrying nothing.

## The ladder this app actually has

Depth here is expressed in **surface colour first, a hairline border second, and
a shadow only when the surface genuinely floats.** The values are Mantine's own
custom properties, which is why they flip with the colour scheme without a
single conditional:

| Rung | What paints it | What sits there |
| --- | --- | --- |
| 0 — ground | `--mantine-color-body` | the page itself |
| 0 — chrome | `AppShell.Navbar` / `.Header` | the nav rail and topbar: beside the page, not above it |
| 1 — raised | `Paper` / `Card` (`withBorder`) | cards, panels, tiles — content grouped on the ground |
| 1 — inset | `--mantine-color-default` | wells, code blocks, table headers — pressed *into* the ground |
| 2 — floating | `Menu.Dropdown`, `Popover.Dropdown`, `Tooltip` | surfaces that open over the page and can be dismissed |
| 2 — modal | `Modal` / `Drawer` + their overlay | a task that owns the screen until it ends |

Two rules follow from the table:

- **A surface changes rung only when its relationship to the page changes.** A
  card inside a card is almost always a card that should have been a section
  with a heading. Nesting `Paper` on `Paper` produces two rectangles the eye
  cannot rank.
- **Chrome is not elevation.** The navbar is not "above" the page; it is beside
  it. `AppShell` gives it its own border and background precisely so nobody
  reaches for a shadow to express adjacency.

## Borders before shadows

In dark mode a shadow is nearly invisible — there is no light to occlude — so
the hairline does the work. `--mantine-color-default-border` resolves to a
low-alpha neutral drawn from the `dark` tuple in `src/theme.ts`, not a fixed
grey. That is deliberate, and it is why a hard-coded `#2a2a2a` border looks
wrong the moment the surface underneath changes.

Rules:

- **Rung 1 gets a border, not a shadow.** `Paper withBorder radius="md"` is the
  whole surface. `Panel` (`src/components/panel.tsx`) is the app's one wrapper
  around that, and it is where a change to the raised surface belongs.
- **Never a border and a divider doing the same job.** A bordered card whose
  first child is a `Divider` at the top edge has drawn the same line twice.
- **A border is one pixel.** A 2px border is a selection state or a focus ring,
  and using it for structure means those states have nowhere to go.

## Shadows

A shadow is a claim that the surface is *above* the page and can be dismissed.
Use it only where that is true:

- **Rung 2 only.** Dropdowns, popovers, tooltips, modals, drawers, and a row or
  card that is actively being dragged.
- **One step per rung.** Two elements at the same rung with different `shadow`
  values is a ranking nobody intended. Set the step once, in
  `components.X.defaultProps` in `src/theme.ts`, rather than at each call site.
- **Never on a page-level container.** A `PageShell` with a shadow is claiming
  the whole page floats above something, and there is nothing behind it.
- **Never as a hover affordance on its own.** Hover moves the background
  (`--mantine-color-default-hover`, or `highlightOnHover` on a table), not the
  elevation. A row that lifts on hover implies it can be dragged.

Mantine's overlay components already default to a floating step; the failure
mode is a screen that adds `shadow="md"` to a `Card` to make it "pop", which
promotes it above the dropdown that opens over it.

## Scrims, blur and glass

- **A modal scrim is required and it is opaque enough to read as one.**
  `Modal`'s own `overlayProps` is the knob; a dialog over an unchanged page is a
  dialog the user tries to click through.
- **Blur is for chrome that content passes under**, and nothing else — a sticky
  header with rows scrolling beneath it. A blurred card that nothing passes
  under is paying a compositing cost for a look.
- **Glass needs something behind it to be glass.** Over a flat surface colour it
  is a slightly wrong grey. If what is underneath is uniform, use the token.

## Gradients

At most **one** gradient per screen, and it belongs on the thing the screen is
about — the hero tile, the brand panel, the empty state's illustration. Two
gradients compete; three is a theme, not a screen. The auth brand panel is the
reference: one radial fade, one blurred colour blob, everything else flat.

## Where a new step would come from

The scale is Mantine's, so adding depth is a theme change and not a per-screen
one:

1. retune or add a step in `theme.shadows` in `src/theme.ts` — sized for a
   dark-first neutral, where a black shadow does almost nothing;
2. point the components that live on that rung at it through
   `components.X.defaultProps`, so no call site has to remember;
3. re-run `make ui-probe` — the rung ordering is measurable, and a dropdown
   whose shadow is weaker than the card beneath it is a violation a person
   should not have to spot.

## Enforcement today

- `ui-lint`'s boundary rule rejects a utility class anywhere in `src/` or
  `.storybook/` — `shadow-*`, `border-*`, `rounded-*`, a colour utility and a
  layout utility alike, because elevation, borders, radius, colour and layout
  are all Mantine's, and there is no debt list left to forgive an exception.
- `hand-rolled-card` catches the other half: a `div` painted to look like a
  surface instead of being one.
- The `ux-prepass` dark-mode item is the practical check: theme values only, no
  raw hex, and every rung verified in both schemes.
- `ui-probe` module C measures hierarchy, so a surface that reads as the same
  weight as its neighbour shows up as a report-only violation before anyone
  argues about it.
