<!-- principle:motion:v6 -->
<!-- Stamped from the shared principles source by stamp-principles.mjs. Edit the source and re-stamp: a hand edit fails principles-drift. -->

# Motion principles

Motion is **token-driven**, **purposeful**, and **reduced-motion-aware**. Every
transition communicates a state change (open / closed / loading / done /
arriving); nothing animates for decoration.

> Source: WCAG 2.3.3 (Animation from Interactions) and the design systems this
> repository's apps are built on.

## Duration scale

| Token | ms | Used for |
| --- | --- | --- |
| `duration-0` | 0 | Disabled / no animation (instant) |
| `duration-100` | 100 | Tiny state changes (toggle, focus ring) |
| `duration-200` | 200 | Default UI transition (hover, menu open) |
| `duration-300` | 300 | Page-level transitions, modal open/close |
| `duration-500` | 500 | Emphasis only (confirmation, success toast) |

Anything off this scale is a literal nobody can retune in one place. Where the
platform ships `ui-lint`, it fails one.

## Easing

- `ease-out` — for entrance animations (open, appear)
- `ease-in` — for exit animations (close, leave)
- `spring` — for physical interactions (toggle, drag, swipe)
- `linear` — banned. Nothing here needs linear motion.

Getting `in` and `out` backwards is the most common way motion reads as
sluggish: an entrance that starts slow makes the app feel like it is thinking.

## What animates, what doesn't

| Pattern | Animate? | Why |
| --- | --- | --- |
| Hover state (button bg, link color) | Yes (100ms, ease-out) | Feedback |
| Focus ring | Yes (100ms, ease-out) | Accessibility hint |
| Dropdown menu open / close | Yes (200ms, ease-out / ease-in) | Spatial continuity |
| Dialog / Sheet open / close | Yes (300ms, ease-out / ease-in) | Big state change |
| Toast appear | Yes (200ms, ease-out) | Notification |
| Toast dismiss | Yes (200ms, ease-in) | Subtle |
| Tab switch | No | Content swap is instant |
| Page navigation | No flash | The frame the user is oriented by never moves |
| Form submit → success toast | Yes (200ms in / 200ms out) | Confirmation |
| Skeleton shimmer | Yes (1500ms loop, ease-in-out) | Loading signal |
| Chart redraw on data change | Yes (300ms) | Data continuity |
| Loading spinner | Yes (infinite, 1000ms) | Wait signal |

## `prefers-reduced-motion`

WCAG 2.3.3 requires the app to be usable when the user has reduced motion
enabled at the OS level. It is an OS setting, which means the user told *every*
app on their machine; this one has no standing to decide its own animation is
the tasteful exception.

Under `prefers-reduced-motion: reduce`, overlays snap open and closed and
entrances arrive in their end state on the first frame. Collapse the duration
to zero; do not remove the animation — an element that skips its animation can
be left in its hidden starting state forever.

```css
@media (prefers-reduced-motion: reduce) {
  .my-component { animation: none; transition: none; }
}
```

## Skeletons, not spinners

A spinner says "wait." A skeleton says "this is where the content will
appear." Skeletons are better because they:

- Preserve the layout (no shift when data arrives).
- Communicate the data shape (a list skeleton shows row count).
- Reduce perceived latency (the user sees structure immediately).

Use a skeleton for any loading state where the data shape is known. Use a
spinner only when the action takes > 1 second AND the shape isn't predictable
(e.g. a long-running export).

## Hover transitions

1. **Background change** — 100ms. The background shifts to the hover variant of
   the token.
2. **Elevation** — 200ms. A shadow grows on hover, on surfaces that benefit from
   a sense of lift — not on every button.
3. **Scale** — banned. Hover = colour or ring, not size.

## Don'ts

- **Don't animate decorative elements.** A spinning logo, a bouncing mascot, a
  parallax scroll — none of these belong.
- **Don't animate every property.** `transition: all` is banned; name the
  property.
- **Don't use durations longer than 500ms.** Anything past that feels laggy.
- **Don't animate `width` or `height`.** Animate `transform`; width and height
  trigger layout.
- **Don't animate on every interaction.** Hover? Yes. Click? No. The click is
  the user's action; let it be instant.

## Verify

1. Every interactive element has a hover state that's visible within 100ms.
2. Every modal / dropdown animates open AND closed (not just open).
3. With `prefers-reduced-motion: reduce` enabled, nothing animates and every
   screen is readable on its first frame.
4. With "Slow 3G" throttling, the skeleton shows within 200ms.
5. Tab through the app — focus rings transition smoothly; no "jumps".

See `ux-prepass` for the mandatory UI gates.

## On this platform — React + Mantine

Two systems carry it, split by what each can actually do. **CSS transitions**
handle the states an element is already in —
hover, focus, a menu opening. **Framer Motion** (the `motion` package, imported
from `motion/react`) handles the states an element *enters and leaves*:
mount, unmount, route change, a list arriving. CSS cannot animate an element
that does not exist yet, and it cannot hold one on screen long enough to leave;
that is the whole reason there is a library here at all.

The tokens for both live in one place: `src/lib/motion.ts`. `ui-lint` fails a
literal duration or easing anywhere in `src/`.

> Source: Mantine's transition defaults + WCAG 2.3.3 (Animation from
> Interactions), and this repo's own probe Module M.

Framer counts in **seconds**, so `src/lib/motion.ts` writes the same scale as
`durations.fast` (0.1), `durations.base` (0.2), `durations.slow` (0.3) and
`durations.emphasis` (0.5). One scale, two units, the same names on both sides.
`raw-motion-duration` fails a numeric literal in a `duration:` position.

CSS names these `ease-in`, `ease-out`, `linear`. Use them by name. Framer takes
control points, so `easings.out` / `easings.in` / `easings.inOut` in
`src/lib/motion.ts` are the same curves as cubic-béziers, and
`raw-motion-easing` fails a literal array or a string like `'easeOut'`.

| Pattern | Animate? | Why |
| --- | --- | --- |
| Page navigation | No wrapper — see below | The arriving page's own blocks are the transition |
| A page's blocks arriving | Yes (300ms, staggered 40ms) | Reading order, once |
| A KPI counting up | Yes (500ms) | Emphasis — one figure per screen |
| Table rows arriving | Yes (200ms, staggered 20ms, capped) | The collection has landed |

## Route changes: the page's own blocks are the transition

**There is no route-transition wrapper, and adding one back is a mistake this
app has already made twice.**

The router unmounts the old page and mounts the new one. The new page's
`Reveal` and `Stagger` therefore run on arrival, all by themselves. That *is*
the route transition, and it is the right one: content blocks lift into place
while the shell — sidebar, topbar, the frame the reader is oriented by — never
moves.

What a wrapper adds is a second fade over the same pixels, and the outer one
covers the whole viewport. The reader sees the page go blank and come back.
That is what "flickering on every page load" is, measured:

```
 488ms  h1=Dashboard  routeOpacity=0     <- whole viewport, invisible
 538ms  h1=Dashboard  routeOpacity=37
 701ms  h1=Dashboard  routeOpacity=100
```

The first attempt was worse still. `<AnimatePresence mode="wait">` holds the
exiting child's React element and keeps rendering it during the exit — and that
child is `<Outlet />`, a live component that renders whatever the router points
at *now*. By the time the exit ran the router had already switched, so the
**destination** page rendered at full opacity, faded itself to zero, and faded
back in:

```
2514ms  h1=Customers  routeOpacity=100
2618ms  h1=Customers  routeOpacity=0
2867ms  h1=Customers  routeOpacity=100
```

Freezing the outgoing subtree is possible — it means capturing the router's
matched tree and re-serving it to the exiting copy — and it buys an exit
animation at the cost of a dependency on router internals that breaks on
upgrade. It is not worth an animation nobody asked for.

Probe rule **M5** is the regression test: nothing that has reached full opacity
may fade back while it stays mounted.

If a surface really does need a keyed transition — the settings pane swapping
sections, where there is no navigation and no scroll movement to signal the
change — key a `Reveal` on the thing that changed (`<Reveal key={active}>`).
That animates one column, not the viewport.

## Entrances: `Reveal`, `Stagger`, `AnimatedNumber`

Everything that arrives on screen arrives through
`src/components/reveal.tsx`, and every figure that counts up through Mantine's
`RollingNumber`. Composing
a one-off `motion.div` in a page is what turns one motion scale into fourteen.

- **`Reveal`** — one block, entering. 8px of travel, not 24: a long slide is a
  flourish the second time you see it and an obstruction the twentieth.
- **`Stagger` + `StaggerItem`** — a group, entering in reading order, 40ms
  apart. The whole sequence has to finish inside the ~300ms the eye reads as
  "the page loaded", so a long list caps its per-item delay rather than letting
  it grow — a 27-row table at 40ms a row is still arriving a second later, and
  the rows below the fold animate where nobody is looking.
- **`RollingNumber`** (Mantine's own) — a figure counting up. **One per
  screen.** It is an emphasis device: it says "this is what you came for". On
  every number it says nothing and costs the reader half a second before any of
  them can be read.

  This app hand-rolled it first, and the hand-rolled one shipped three defects
  that are props on the real component: the in-flight value printed as
  `17.53475804302434` (`decimalScale`), the box resized every frame and dragged
  the delta beside it (`tabularNumbers` and per-digit columns), and the value
  was announced sixty times a second instead of once (`withLiveRegion`).
  Pass `animationDuration={0}` under reduced motion — `RollingNumber` does not
  carry Mantine's `data-reduce-motion`, so `respectReducedMotion` on the
  provider does not reach it, and probe rule M1 fails the page if you forget.

Every one of them carries `data-motion`, which is what Module M measures.

### Reduced motion here

*every* app on their machine; this one has no standing to decide its own
animation is the tasteful exception.

**This app snaps.** Not "fades instead of sliding" — the end state, on the
first frame. Framer's own `reducedMotion="user"` suppresses transform and
layout animation and still fades, which is a defensible reading of the spec and
the wrong one for a user whose reason for setting it is vestibular: a 300ms
fade on every route change is still 300ms of the screen not being readable. The
provider sets it as a floor; `useMotionEnabled()` in `src/lib/motion.ts` is the
real answer, and every component here reads it.

Two traps, both of which this app walked into:

- **Do not use Framer's `useReducedMotion()`.** It resolves through a
  module-level value that is wrong on the *first render* and corrects itself
  afterwards — so every entrance started from its hidden state and only then
  discovered it should not have. `useMotionEnabled()` uses
  `useSyncExternalStore`, which reads during render.
- **Collapse the duration; do not remove the animation.** An element that skips
  its `animate` never leaves `initial`, so a variant starting at `opacity: 0`
  stays invisible forever. Zero duration means it arrives on the first frame.
  Probe rule **M2** is the gate.

Mantine handles its own components — set `respectReducedMotion` on the provider
(it is on by default) and:

- `Modal`, `Drawer`, `Menu`, `Popover`, `Tooltip` — all snap open
  / closed with no animation under `prefers-reduced-motion: reduce`.
- Framer's own `reducedMotion="user"` is set once in `ThemeProvider`, so a
  `motion` element that forgets to guard itself still degrades.

For custom animations, wrap with the
`@media (prefers-reduced-motion: reduce)` rule:

```css
@media (prefers-reduced-motion: reduce) {
  .my-component { animation: none; transition: none; }
}
```

In a component, `useMotionEnabled` from `@/lib/motion` collapses a duration to
zero rather than branching on two code paths.

## The gate

Motion is measured, not asserted. `ui-lint` reads the source;
**Module M** of the UI probe reads the running app in real Chromium
(`scripts/ui-probe/motion.probe.tsx`):

| Rule | What it fails |
| --- | --- |
| **M1** | Anything animating, or starting hidden, with `prefers-reduced-motion: reduce` emulated through CDP |
| **M2** | A `[data-motion]` element that settles at less than full opacity or off its layout position — the entrance that never fired |
| **M3** | An element that changes size while animating, or an infinite loop that is not a loading indicator |
| **M4** | *Nothing moved.* The anti-vacuity rule: if no sample ever catches an element in flight, the choreography has been switched off and M1–M3 are passing on an app with no motion in it |
| **M5** | An element that reached full opacity and faded back while still mounted — a replay, which is what a reader calls a flicker. The only rule here that reads a *transition* rather than a mount |

M4 exists because the first version of this module was built on
`document.getAnimations()` and measured nothing at all: Framer writes inline
styles from its own rAF loop and never registers there, so every rule passed
on a page that was visibly animating with reduced motion switched on. Module M
samples the rendered result instead — opacity, transform and box, twice, a
frame apart — which works whatever drives the pixels.

Beyond the general checks: `npm run ui-probe` is green and reports something
for M4 to have seen; and clicking between two pages never dims or blanks the
whole viewport.
