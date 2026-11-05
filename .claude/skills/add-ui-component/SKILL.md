---
name: add-ui-component
description: Add or extend a shared UI component the right way — a Mantine component configured through the theme, or an app composite in src/components/ that reads the same tokens. Use when the user wants a new reusable component, a variant, or a shared widget.
---

# add-ui-component — extend the design system

Mantine is the design system. It is dark-first here, themed once in
`src/theme.ts`, and every component reads that theme — so the job is almost
never "write a primitive", it is "configure the one that exists" or "compose the
product's own piece out of them".

## Rules

- **Check Mantine first, by listing it — not from memory.**

  ```
  ls node_modules/@mantine/core/lib/components/
  ```

  The installed package is the authority. Mantine 9 ships components that did
  not exist when parts of this app were written, and `saas-004` deleted four
  composites this repo had hand-rolled against them — including a counting
  number re-implemented **two commits earlier**, which shipped three defects
  that are props on `RollingNumber`. `@mantine/core` ships the primitive nine
  times out of ten — `Table`, `Progress`, `ScrollArea`, `Textarea`, `SegmentedControl`,
  `Menu`, `Modal`, `Tabs` — and the packages beside it cover the rest:
  `@mantine/dates`, `@mantine/charts`, `@mantine/carousel`,
  `@mantine/spotlight`, `@mantine/notifications`. Hand-rolling one of these is
  the single most common way this UI goes out of theme, and `make ui-lint`
  fails the build on the common cases (raw `<table>`, `<button>`, `<input>`,
  `<textarea>`, `<select>`, hand-built progress bars and badges).
- **App composites live in `src/components/`.** `DataTable`, `EmptyState`,
  `PageShell`, `Panel`, `StatCard` and the shell pieces are the product's own
  components — the ones with an opinion Mantine has no reason to hold. A new
  one goes beside them, with a sibling `.stories.tsx` and an entry in
  `docs/storybook-taxonomy.json` (`storybook-lint` R8 fails without both).
- **Colour, border, radius, elevation and layout are all Mantine's.** Pass `c`,
  `bg`, `color`, `variant`, `radius`, `shadow`, `withBorder` — or read a theme
  custom property (`var(--mantine-color-default-border)`) when the element is
  not a Mantine component. Layout is `Group`, `Stack`, `Flex`, `SimpleGrid`,
  `Grid`, `Center` and `Box`; the spacing props (`p`, `m`, `gap`) take theme
  names. `ui-lint`'s boundary rule rejects a utility class everywhere, with no
  exempt directory. What an inline style cannot express — a media query — goes
  in a CSS module beside the component.
- **A variant is a theme decision, not a wrapper.** Recurring styling belongs in
  `theme.components.<Component>` in `src/theme.ts` — `defaultProps`, `styles`,
  or a `classNames` entry — so every instance changes together. A local wrapper
  around a Mantine component with hard-coded props is a second theme.
- **Retune the palette in `src/theme.ts`**, never in a component. No hex, no
  `oklch()` outside that file.

## Adding a Mantine component the app has not used yet

Import it and use it — but read its entry in
[`mantine-capabilities.md`](../use-mantine/mantine-capabilities.md) first, and
**write the entry if there is none**: `capability-lint` fails the build on a
component the source imports and the map does not explain, which is how the map
stays a routing table instead of a snapshot.

If it needs the same configuration in three places, that is the signal to move
the configuration into `src/theme.ts` rather than to copy it a fourth time.

## Adding an app composite

1. Write `src/components/<name>.tsx`, built from Mantine components.
2. Write `src/components/<name>.stories.tsx`: a taxonomy title, at least three
   named stories, an explicit `parameters.layout`, and `argTypes` if it takes
   props.
3. Add `<name>` to a section's `members` in `docs/storybook-taxonomy.json`, then
   run `make storybook-docs` — the section pages and the Introduction table are
   generated from that file, and `storybook-lint` fails if they are stale.
4. If the choice between it and a Mantine component is a genuine family
   decision, record it in `docs/principles/component-selection.md`.

## If it animates

Motion is a token layer, and there are exactly three places it comes from:

- `src/lib/motion.ts` — `durations`, `easings`, `transitions`, and the variants.
  A numeric duration or a literal easing anywhere in `src/` fails `ui-lint`
  (`raw-motion-duration`, `raw-motion-easing`).
- `src/components/reveal.tsx` — `Reveal`, `Stagger`, `StaggerItem`, for anything
  that arrives on screen.
- `useMotionEnabled()` — the reduced-motion answer. Call it rather than Framer's
  `useReducedMotion()`, which is wrong on the first render, and collapse the
  *duration* to zero rather than dropping the `animate`: an element that never
  animates never leaves its `initial`, which is how content ends up in the DOM
  at `opacity: 0`.

Mark anything you animate with `data-motion="<kind>"`. That attribute is what
probe Module M measures, and an animated element without it is invisible to the
gate. See [`docs/principles/motion.md`](../../../docs/principles/motion.md).

## Verify

`npm run type-check`, then `npm run ui-lint`, then render the component on a
page (or the Dashboard) via `npm run dev` and toggle the theme to confirm it
reads correctly in both.

<!-- ux-prepass:v2 -- canonical 7-item checklist lives in `.claude/skills/ux-prepass/SKILL.md`. -->
See `ux-prepass` for the mandatory UI gates. Confirm every box before marking this task done.
