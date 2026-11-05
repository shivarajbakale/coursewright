<!-- principle:screen-archetypes:v2 -->
<!-- Stamped from the shared principles source by stamp-principles.mjs. Edit the source and re-stamp: a hand edit fails principles-drift. -->

# Screen Archetypes

Every page is one of a small number of shapes, and saying which one before you
start is the difference between a layout and an arrangement. The vocabulary of
shapes is the platform's — its section at the end of this document lists them
and names the gate that holds each one.

## The failure this prevents

**The page that is a list of cards.** Left to itself, a generated page becomes a
title, then a stack of equal-weight cards, top to bottom. Nothing is the focal
point, nothing is subordinate, and the eye has nowhere to land — so the screen
reads as filler even though every atom in it came from the kit and every gate
was green.

Naming the archetype forces the question a vertical stack lets you skip: *what
is this screen for, and what is the one thing on it?*

The other failure is quieter. A screen with no declared shape cannot be checked
— `ui-probe` can measure that a card is 320px wide, but not that a
master-detail view has a master. The archetype is what turns a layout opinion
into an assertion.

## Step 0 — name the surface's job before you pick its shape

Two questions, answered in `BLUEPRINT.md` or in the feature's plan before any
layout is drawn:

1. **Who opens this and what were they doing a second ago?** A screen reached
   from a nav rail, from a row click, from an email link and from a failed
   action are four different screens even when they show the same record.
2. **What is the one thing they came for?** Write it as a sentence. If the
   sentence has an "and" in it, you are planning two screens.

Then pick the shape. If two shapes both fit, the screen is two screens.

## What is not an archetype

- **A modal, a sheet, a popover, a toast.** Overlays are not screens: they
  inherit the shape of the surface underneath and are planned in the feature
  plan's `overlays[]` instead.
- **A loading skeleton.** It is one of the four states of whatever archetype it
  belongs to — see [../UX.md](../UX.md).
- **A marketing landing page.** It has a different job (persuade a stranger)
  and a different grammar (sections, not panels). If the app grows one, it gets
  its own vocabulary rather than a bad fit inside this one.

## Two archetypes is two screens

A screen that fits two shapes is two screens. The common case is a detail page
that grew a collection inside it; the inner collection belongs on its own route,
reached from a section heading's "See all". Split before you compose, not after
the page has already grown past its scroll budget — see
[density-and-disclosure.md](density-and-disclosure.md).

## On this platform — React + Mantine

Eight shapes.

## Where this vocabulary lives

Four places, and they are kept in agreement by a gate:

| Place | What it holds |
| --- | --- |
| this document | what each shape is for, and the rules that follow from that |
| `src/components/page-shell.tsx` | the `Archetype` union, published to the DOM as `data-archetype` |
| `scripts/feature-plan.mjs` | the planner's vocabulary and the wireframe it draws for each shape |
| `scripts/ui-probe/rules/archetype.ts` | Module B — what the browser is held to |

`plan-lint`'s **P5** fails when those drift. Adding a ninth shape is a change
to this document first, to the union and the planner second, and to the probe
rules third — in that order, because a shape the probe checks but nobody
described is a rule with no reason attached.

## `dashboard-grid` — the overview

**One hero, then a row of equal tiles, then unequal supporting panels.**

For: the screen the user lands on. They opened the app to learn one thing and
decide what to do next.

- A dashboard answers questions in a fixed order: *is anything wrong* (the
  hero), *what are the numbers* (the KPI row), *what changed* (the trend), *what
  needs me* (the queue). That order is the layout.
- The KPI row is **2 to 4 tiles of equal width**. Five tiles is a table wearing
  a grid's clothes, and unequal tiles in a row read as a ranking nobody
  intended.
- Every other row may be unequal — a wide chart beside a narrow activity list
  is rhythm; six identical cards is not.
- **Size panels to their content.** A panel stretched to match its tallest
  sibling and carrying 200px of nothing is the most common defect here, and
  probe rule B2 measures exactly that. At most one panel may declare
  `data-fill` and absorb the leftover height.
- Cap it. More than about six panels and the user is scrolling a report.

`Card`, `StatCard`, `ChartCard`, `Panel`. Tiles carry `data-panel="kpi"`, the
hero `data-panel="hero"` — that is the probe's hook, not decoration.

Probe: **B2**.

## `list` — a collection, full width

**One collection, a filter pinned above it, rows that go somewhere.**

For: any collection the user scans, filters and then leaves — customers, an
inbox, a team roster, invoices. The row is a link, not a selection.

Use this rather than `list-detail` when the member deserves the whole width
when you get there: long content, many sections, or a reader who arrived from a
link and never saw the list. `list-detail` earns its second pane only when the
job is working *through* members one after another without losing your place —
triage, review queues, moderation.

- **One `h1`, and it is the collection's name.** Two means two collections, and
  two collections are two routes.
- **The filter is pinned above the rows, never inside them.** A filter that
  scrolls away with the rows is gone exactly when it is wanted: the user reaches
  for it because they have scrolled far enough to be lost.
- **Filtering happens in place.** A search that navigates has lost the user's
  place in the collection.
- **The rows scroll, the page does not.** `PageShell scroll={false}`, and the
  collection owns the one scroll region.
- Rows: identity first, metadata second, row actions last. A row is a link to
  the member's route — the whole row, not a chevron at the end of it.
- **Columns are sized from their widest cell, not their header.** A `Badge`
  truncates rather than overflows, so an under-wide column ships `ENTE…` and
  looks like a bug rather than a layout choice.
- One primary action, in the title band, outside the scroll region.
- The empty state is designed content, and it distinguishes *no rows yet* from
  *no rows match this filter* — they are different problems with different
  fixes.

`PageShell` with `scroll={false}`, `DataTable`, `SegmentedControl` for scope,
`TextInput` with a leading icon, `EmptyState`.

Probe: **B8**.

## `list-detail` — a collection and one of its members, side by side

**Master pane, resize handle, detail pane. Two panes, never three.**

For: a collection the user works through one member at a time without leaving
the collection — a triage queue, a review inbox, a moderation list. When the
member is a record people link to and read on its own, the pair is `list` and
`detail` on two routes instead; see `list` above.

- **The master is the wider pane.** Inverting that makes the list feel like a
  sidebar of the detail, which is a different screen with different navigation.
- There is a **resize affordance** between the panes. A split the user cannot
  move is a split that is wrong for half of them.
- The detail pane's empty state is **designed content**, not a blank half. "Select
  a customer" with an icon and a one-line explanation is the minimum; a blank
  pane reads as a loading failure.
- Filtering and search sit above the master, and filter the list **in place**.
  A search that navigates away has lost the user's place in the collection.
- Rows: identity first, metadata second, row actions last.
- On a narrow viewport the two panes become two routes. The detail gets a back
  affordance; it does not become a modal.

`ResizablePanelGroup`, `Panel`, `EmptyState`, `Input` with a leading icon,
`DataTable`.

Probe: **B1**.

## `detail` — one subject, on its own route

**A named subject, content in titled sections, a primary action that does not
scroll away.**

For: the record page — an invoice, a customer, a deploy, a document. Reached
from a collection row, from a link in an email, from search.

Use this rather than `list-detail` when the subject deserves the whole width:
long content, many sections, or an audience arriving from outside the app who
never saw the list.

- **One `h1`, and it is the subject's name** — not the section's name. A page
  that opens on "Invoice" above "INV-2043" has spent its headline on a category
  the nav rail already showed.
- Content lives in **titled sections**, not one wall. A section with no heading
  is content the user cannot skip, and skipping is how records get read.
- The **primary action is pinned** and outside the scroll region. Approve, Pay,
  Deploy, Delete — the action the page exists for must be reachable at any
  scroll position. Mark it `data-primary-action`.
- Secondary actions collapse into an overflow menu. A row of five buttons has
  no primary.
- **A detail page that grows a list belongs on two routes.** The usual case is a
  record page that sprouts an activity feed with its own filters; that feed is a
  collection, and it gets a "See all" that goes somewhere.

`PageShell`, `Panel`, `Separator`, `DropdownMenu` for the overflow, `Badge` for
status.

Probe: **B5**.

## `form` — data the user types

**One column, labels above, one submit.**

For: create, edit, compose, invite, request.

- **One column. Always.** Two-column forms measure slower and break at 200%
  zoom, and the second column is almost always fields nobody needed.
- **Labels above their fields.** A label beside its field costs a fixation to
  associate, and its width caps how long a label may be — which is how forms end
  up with labels that are abbreviations.
- Helper text below the field; the **error replaces the helper** so the layout
  does not jump when validation fires.
- The column caps at **640px**. Wider, and the eye has to travel back across
  dead space to find the next label.
- **One submit.** Cancel is a ghost or link button, never a second filled one.
  Two filled buttons is a choice the user has to read twice.
- Validate on submit first, then on blur once they have submitted once.
  Validating an empty field the user has not reached yet is an accusation.
- Disable the submit while it is in flight and show its pending state. A double
  submit is a duplicate record.

`Form`, `Field`, `FieldLabel`, `FieldDescription`, `Input`, `Select`, `Button`.

Probe: **B3**.

## `settings` — preferences that apply when you change them

**A section rail, grouped sections, immediate-apply controls, destructive last.**

For: account settings, workspace settings, integration configuration.

A settings page is not a long form, and the difference is the moment the change
takes effect.

- **A switch means the change applies immediately.** If it needs a Save button
  it was never a switch — it is a checkbox in a form. Probe rule B6 fails a
  `role="switch"` inside a form that has a submit, because that control lies
  about when it took effect.
- **A section rail, not a scroll.** The rail (or, on narrow viewports, a tab
  strip) is what makes a settings page navigable; a single 4000px scroll makes
  the user hunt.
- Group by **what the user is trying to change**, not by which service owns it.
  "Notifications" is a group; "Webhooks service" is an org chart.
- The **content column owns the scroll**, and it is the only vertical scroller
  on the page. The rail stays put, so switching sections does not lose context.
- **Destructive actions live in their own section, last**, and their confirm
  names the object being destroyed.
- Explanations go under the control they explain, one line. A paragraph inside a
  settings row is a paragraph nobody reads.

`Panel`, `Switch`, `Tabs` for the narrow-viewport rail, `Separator`,
`AlertDialog` for the destructive confirm.

Probe: **B6**.

## `sequence` — several steps, in an order you chose

**One decision per step, honest progress at the top, a way back that costs
nothing, and a handover at the end.**

For: onboarding, a setup wizard, a multi-step request, a checkout.

A sequence is not a form split across screens. A form asks for a record; a
sequence builds commitment, and the order is the design.

- **Every step names its job** — orient, collect, decide, confirm. A step that
  cannot name one exists because it was easy to build, and it is cut. This is
  the question a step count lets you skip.
- **One decision per step.** Two questions is two steps.
- **Exactly one step is on screen.** Steps that are all rendered and hidden by
  opacity are a long form that scrolls badly.
- **Progress is at the top and honest.** "Step 2 of 4" that turns out to be 7 is
  worse than no progress at all. Progress and the primary action never share the
  bottom edge.
- **Back never destroys an answer.** A user who steps back and forward again
  sees what they typed. This is the rule most often broken and the one users
  notice fastest.
- **The last step hands over** — to the dashboard, to the record just created,
  to the thing they came to do. A sequence that ends on itself is one the user
  abandons at the finish line.

`Progress` or `Stepper`, `Panel`, `Button` for Next, a ghost Back, `Form`
inside a step where the step collects data.

Probe: **B7**.

## `centered-card` — one task, no app chrome

**A single card, centred, under 480px, and the view does not scroll.**

For: sign in, sign up, accept an invite, a 404, an expired link, a confirmation.

The defining property is what is *absent*: no sidebar, no topbar, no nav. The
user has exactly one thing to do and nowhere else to be, and removing the chrome
is what says so.

- **One card.** Two cards means the user is choosing, and a choice is a
  `sequence` step or a `form`.
- **Under 480px** and centred on both axes. A wide centred card is a form
  pretending the chrome is missing on purpose.
- **It does not scroll.** A sign-in that scrolls has more in it than a sign-in
  needs. If the content genuinely does not fit, it is a `form` on a route with
  chrome.
- Brand furniture may sit beside the card — the auth split-screen's brand panel
  is chrome, and the archetype is declared on the column that holds the card,
  not on the whole viewport.
- One primary action, and one escape hatch as a link.

`Card`, `Form`, `Button`, `Separator` for the "or continue with" divider.

Probe: **B4**.

## Shapes this document does not declare yet

Three more are common in this category and each is a real change — the doc, the
union, the planner's frames, the probe rule and its tests — rather than a
paragraph. `list` was one of them until the Customers slice needed it, and it
cost exactly that:

| Shape | Would be |
| --- | --- |
| `insight` | one number, one chart, one sentence saying what the number means. A recap, not a dashboard. |
| `board` | columns of draggable cards; the column is the state and the drag is the edit. |
| `editor` | a canvas with a properties panel; the content is the chrome's reason to be narrow. |

## The demo pages

Every page this project ships is one of the eight and declares it. Replace them
with your own — the point of naming the archetype is that the replacement
inherits a shape rather than a screenshot.

| Page | Archetype |
| --- | --- |
| `Dashboard.tsx` | `dashboard-grid` |
| `Customers/CustomersPage.tsx`, `InboxPage.tsx`, `TeamPage.tsx` | `list` |
| `Customers/CustomerDetailPage.tsx` | `detail` |
| `BillingPage.tsx` | `form` |
| `Settings.tsx` | `settings` |
| `Auth/LoginPage.tsx`, `Auth/SignupPage.tsx`, `NotFoundPage.tsx` | `centered-card` |

`src/test/declarations.test.tsx` fails when a routed page declares no archetype
at all, because an undeclared page is a page no Module B rule can reach.

## Choosing

| The screen is… | Archetype |
| --- | --- |
| the first thing after sign-in | `dashboard-grid` |
| a collection you scan, filter and leave | `list` |
| a collection worked through one member at a time, in place | `list-detail` |
| one record, on its own URL | `detail` |
| data the user types | `form` |
| preferences that apply on change | `settings` |
| several steps in an order you chose | `sequence` |
| one task, with the app chrome removed | `centered-card` |

A screen that is two archetypes is two screens. The common case is a `detail`
that grew a `list-detail` inside it; the inner collection belongs on its own
route, reached from a section heading's "See all".

The one exception worth stating: a `sequence` step may be shaped like a `form`,
but it is governed by the sequence's rules — its job, its progress, its
handover — and it is planned as a `sequence`.
