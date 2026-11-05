---
name: use-mantine
description: Pick the right Mantine component before you write a screen — the capability map with Use when / Instead / reference slice / gotcha for every family this app uses (actions, text, form fields, feedback, overlays, navigation, data display, layout, theme). Use when composing any UI, choosing between two components, or hitting a Mantine prop that does not behave as expected.
---

# use-mantine — the routing table

Mantine is the design system here. There is no wrapper kit to read: pages
import `@mantine/core` directly, `src/theme.ts` holds every default, and
`src/components/` holds only this product's own composites.

That means the knowledge an agent needs is not "what did we wrap" but "what
does Mantine already have, and which one of the three plausible ones is right".
That is [mantine-capabilities.md](mantine-capabilities.md) — read it before
composing a screen, not after a gate fails.

## How to use it

1. **Search the map by what the user wants to do**, not by component name. The
   entry names the component, the package, the neighbour you might have reached
   for by mistake, a slice of this repo that already does it, and the gotcha.
2. **When two families are both defensible**, the choice is in
   `docs/principles/component-selection.md` — tooltip vs popover vs modal, tabs
   vs rail vs route, select vs autocomplete. The map is per-family; that file is
   the choice between families.
3. **Copy the reference slice.** Every `Ours:` line points at working code in
   this repo. An entry that reads *(not wired…)* has a decided pattern and no
   code — you are writing the first one, so fill the line in when you do. The
   map covers the whole of `@mantine/core`, not only the parts already used, so
   "it is not in the map" is never a reason to hand-roll something.
4. **Set the default in the theme, not the call site.** Three call sites passing
   the same prop is a `components.X.defaultProps` entry in `src/theme.ts`.

## The cascade, in one line

Mantine owns colour, border, radius, elevation, typography, state **and**
layout — there is no second styling system. `make ui-lint` fails the build on a
utility class anywhere in `src/` or `.storybook/`, and there is no debt list
left to forgive an exception.

## Keeping the map honest

`npm run capability-lint` (inside `make check`) fails when an entry loses a
field, names a component the installed packages do not export, names a package
that is not a dependency, points at a file that moved, leaves a component the
source imports undocumented, or leaves a component `@mantine/core` ships neither
routed nor refused under **Deliberately not routed**. `npm run doc-links` fails
when the sources stop being Mantine's own documentation or go more than 180 days
stale.

So the map cannot rot quietly, and adding a component without adding its entry
turns the build red on purpose.
