---
name: ux-prepass
description: The mandatory UI/UX pre-pass checklist every UI-touching skill runs before declaring its task done. Single source of truth — the shared items and this platform's items live here, every UI skill links here, and evaluator-rubric.md's "UI pre-pass" row references this same wording.
---

<!-- ux-prepass:v4 -->
<!-- Stamped from the shared ux-prepass source by stamp-principles.mjs. A hand edit is overwritten by the next stamp. -->

# ux-prepass — the UI pre-pass checklist

This is the **single source of truth** for the items every UI-touching task must
pass before it's done. The wording here is the wording referenced from:

- `evaluator-rubric.md` (Visual Quality → "UI pre-pass" row).
- The `verify` skill (the closing sanity checks).
- The `add-feature`, `add-page`, `add-api-endpoint`, `add-ui-component`, `auth-page`, and `wire-to-backend` skills (their Verify sections).

Do not inline the checklist into another file — that is what this skill exists
to prevent.

> This checklist catches *how* a screen is built. The decisions that come before
> it — which shape the screen takes, which controls it uses, how much it shows
> at once — are argued in:
>
> - [`docs/principles/nielsen-heuristics.md`](../../../docs/principles/nielsen-heuristics.md)
> - [`docs/principles/microcopy.md`](../../../docs/principles/microcopy.md)
> - [`docs/principles/wcag-2.2-aa.md`](../../../docs/principles/wcag-2.2-aa.md)
> - [`docs/principles/motion.md`](../../../docs/principles/motion.md)
> - [`docs/principles/emotional-design.md`](../../../docs/principles/emotional-design.md)
> - [`docs/principles/density-and-disclosure.md`](../../../docs/principles/density-and-disclosure.md)
> - [`docs/principles/screen-archetypes.md`](../../../docs/principles/screen-archetypes.md)
> - [`docs/principles/component-selection.md`](../../../docs/principles/component-selection.md)
> - [`docs/principles/spacing-and-type.md`](../../../docs/principles/spacing-and-type.md)
> - [`docs/principles/depth-and-materials.md`](../../../docs/principles/depth-and-materials.md)

## Shared items (every platform)

- [ ] **Four states handled:** loading, empty, error, success. Every async
  surface renders all four. Missing any one is a bug.
- [ ] **Tap targets ≥ 44×44** on every interactive element.
- [ ] **Visible focus states** on every interactive element (`:focus-visible`
  ring, not a colour change alone).
- [ ] **Keyboard navigable** — tab order is logical, Enter / Esc behave as
  expected, and the surface is fully usable without a pointer.
- [ ] **Density and disclosure** — the page fits its job without a long scroll:
  at most 2.5 viewports tall on a 1040px-tall desktop, the primary action inside
  the first viewport, at most one banner at a time, success shown as a toast,
  confirmation as a modal, and secondary content in a sidebar, a tab or a
  collapsed section rather than one more card down the page.

## React + Mantine items

- [ ] **Dark mode checked** — theme values only (Mantine props such as
  `c="dimmed"`, or `var(--mantine-color-*)`), and no raw hex / rgb / hsl /
  oklch in the diff. Dark mode, depth and elevation follow
  [`docs/principles/depth-and-materials.md`](../../../docs/principles/depth-and-materials.md).
- [ ] **Text overflow handled** — long strings truncate or wrap without
  breaking the layout (`<Text truncate>` on the string and
  `style={{ minWidth: 0 }}` on its flex parent, or a sensible `maw`), not a
  hidden overflow that clips the wrong thing.
- [ ] **Composed, not hand-rolled** — every primitive on the screen comes
  from `@mantine/core`, and every product-level piece from
  `src/components/`. No styled `<span>` standing in for a pill where `Badge`
  exists, no hand-built surface where `Card` or
  `Paper withBorder` exists, no `<button aria-pressed>` pills where `Tabs` /
  `SegmentedControl` / `Radio.Group` exist, no raw `<button>`, `<input>`,
  `<textarea>`, `<select>`, or `<table>`. Colour, border, radius, elevation and
  layout are all Mantine's, and a utility class is not a thing this app has.
  Prove it with `npm run ui-lint`: a green run is the evidence for this box.
- [ ] **The screen has a declared shape** — the page renders inside
  `PageShell` with the archetype from
  [`docs/principles/screen-archetypes.md`](../../../docs/principles/screen-archetypes.md).

## Where the boxes get checked

`npm run ui-lint` is the evidence for the composed box. `make a11y` is the gate for focus, targets and keyboard (the machine-checkable floor of WCAG 2.2 AA). `npm run ui-probe` measures the archetype, overflow and motion in real chromium. The rest are yours to confirm by driving the screen — see the `verify` skill.

## How skills reference this

In a skill's Verify section, replace any inline pre-pass block with:

```md
See `ux-prepass` for the mandatory UI gates. Confirm every box
before marking this task done.
```

The `<!-- ux-prepass:v4 -->` marker at the top of this file is the version — bump
it and update every reference if the items ever change in a breaking way.

## Why it's a skill, not a doc

A skill is an actionable unit an agent can read by name, and it appears in the
same Skills table every agent already reads at session start. A checklist in
`docs/` gets found only by someone already looking for it.
