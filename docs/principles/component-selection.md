<!-- principle:component-selection:v1 -->
<!-- Stamped from the shared principles source by stamp-principles.mjs. Edit the source and re-stamp: a hand edit fails principles-drift. -->

# Component Selection

Every other gate in this repo checks that a screen was built *correctly*.
None of them check that it was built out of the *right parts*.

`ui-lint`'s twenty-two rules all ask one question — did you hand-roll or
hardcode something Mantine already owns? The evaluator rubric's design-system
row asks the same. `ux-prepass` item 7 asks the same. So a Settings page built
as a nine-tab tab bar, a required warning buried in a tooltip, or a
twelve-option `Select` passes every automated check in the repository, because
every control on the screen came from `@mantine/core`.

Choosing the wrong control is the most common way a screen built entirely from
the design system still feels wrong to use. This document is the missing half:
per-family guidance — what a component is for, and which neighbour is reached
for by mistake — lives in `Use when:` / `Instead:` in
`.claude/skills/use-mantine/mantine-capabilities.md`; the cross-family
decisions, the ones where three or four components are all defensible and only
one is right, live here.

## The default

**When two options are defensible, pick the one that is visible, addressable,
and works without a pointer.** Nearly every rule below is that sentence applied
to a specific family. A route beats a modal because it has a URL. Visible
helper text beats a tooltip because it survives touch and scanning. A grid
beats a carousel because nothing is hidden. Reach for the cleverer option only
when you can say what it buys.

## Disclosure — Tooltip / HoverCard / Popover / Modal

Three questions, in order:

1. **Is the content needed to succeed at the task?** If yes, it is not
   disclosure at all — put it on the page as visible helper text, or in the
   input's own `description` prop. Tooltips and hover cards do not exist for
   touch users, screen scanners, or anyone working quickly.
2. **Is it interactive?** Anything with a control inside — a button, a field, a
   link the user must click — needs `Popover` (or `Modal`). Hover-triggered
   surfaces cannot hold interactive content; the pointer has to travel there
   and the surface closes.
3. **Does it deserve a focus trap?** If the user must finish or dismiss before
   continuing, it is a `Modal`. If they can click away and lose nothing, it is
   a `Popover`.

| Component | Trigger | Content | Typical use |
| --- | --- | --- | --- |
| `Tooltip` | hover / focus | a few passive words | naming an icon button |
| `HoverCard` | hover | rich, passive, optional | previewing a user or a link |
| `Popover` | click | small, may be interactive | a filter, a colour picker, a mini form |
| `Menu` | click | a list of actions | a row's overflow, an account chip |
| `Modal` | click | a task with a beginning and an end | create / edit / confirm |

An icon-only `ActionIcon` always gets a `Tooltip` **and** an `aria-label`. The
tooltip is for sighted pointer users; the label is for everyone else. Neither
substitutes for the other, and Mantine's tooltip does not supply a name.

## Task surfaces — Modal / Drawer / route

| Surface | Reach for it when | |
| --- | --- | --- |
| `Modal` | short focused task, page context worth keeping visible | 1–2 fields, a confirm |
| `Drawer` | mid-length task or secondary context; `position="right"` on desktop | detail panel, filters |
| `Drawer` bottom | the same at phone width | `position="bottom"` |
| a route | long, deep-linkable, expensive, or shareable | full create/edit flow |

The discriminator is **length and addressability**, not visual preference. If a
user would ever want to send someone a link to this state, or refresh without
losing it, it is a route. If the task has more than about five fields, it is a
route. Overlays lose their content on reload and cannot be bookmarked; that is
the cost you are paying, so get something for it.

Mantine gives `Modal` and `Drawer` the same API — `opened` / `onClose`, the
same focus trap, the same `data-autofocus` — so the choice between them is
purely about how the content wants to sit, and swapping one for the other is a
prop change.

Destructive confirmation is a separate case and always
`modals.openConfirmModal` from `@mantine/modals`, naming the object:
`Delete "Acme"?`, with `confirmProps={{ color: 'red' }}`. A reversible action
gets no dialog at all — apply it optimistically and put undo in a notification.
Interrupting someone to confirm something you could simply undo is a worse
experience than the mistake you are preventing.

## Sectioning — Tabs / Accordion / sidebar rail / separate routes

| Pattern | Reach for it when |
| --- | --- |
| `Tabs` | 2–6 peer views of one subject, cheap to switch, never needed side by side |
| `Accordion` | independent sections, long content, users need one at a time |
| a `NavLink` rail | more than ~6 sections, or the sections are destinations rather than views |
| separate routes | each view is deep-linkable, independently loadable, or expensive |

Failure modes worth naming, because agents hit all three:

- **Tabs that should be routes.** If tab state should survive a refresh or be
  linkable, it belongs in the URL.
- **Tabs for settings.** Settings sections are destinations, not peer views of
  one object. Use the Stripe-style rail of `NavLink`s — see the `add-settings`
  skill.
- **Tabs that keep growing.** Past six, the row wraps or scrolls and scanning
  collapses. Move to a rail before that, not after.

Content the user needs to **compare** must never be split across tabs or
accordion panels. Comparison requires simultaneity.

## Choosing a value — Switch / Radio / SegmentedControl / Select / Autocomplete

Option count decides it, then whether the options need explaining:

| Count | Pattern |
| --- | --- |
| 2, mutually exclusive, applies instantly | `Switch` |
| 2–5, comparison helps, options need labels or descriptions | `Radio.Group` |
| 2–5, short, and the choice re-renders the view beside it | `SegmentedControl` |
| ~5–10, fixed and known | `Select` |
| 10+, or the user knows the name and typing is faster | `Autocomplete`, or `Select searchable` |
| many, and more than one may be chosen | `MultiSelect` / `TagsInput` |
| a free-form set the user invents | `TagsInput` |

`Switch` vs `Checkbox` is not a style choice: **`Switch` applies immediately,
`Checkbox` is submitted with a form.** A switch beside a Save button is a
broken promise, and a checkbox that silently persists on click is a different
one.

`SegmentedControl` vs `Tabs` is the same distinction one level up: a segmented
control changes a *parameter* of one view (the range, the density, the sort);
tabs change *which view* you are looking at. If each option would want its own
URL, it was tabs — or routes.

Never make someone type a value you already have — that is an `Autocomplete`,
not a `TextInput`.

## Telling the user something — notification / Alert / field error / EmptyState

| Surface | Lifetime | Scope |
| --- | --- | --- |
| a notification (`notify.*`) | transient | the action that just completed, plus undo |
| `Alert` | persistent | a region or the page — standing state or warning |
| an input's `error` prop | until fixed | one field |
| `EmptyState` (ours) | until data exists | one list or pane |

A validation error never goes in a notification: it must sit beside the field —
which for a Mantine input means its own `error` prop, not a sibling element —
and it must persist until fixed. Anything the user has to act on later never
goes in a notification either: they leave, and they leave fastest for the
people reading slowest.

## Showing records — Table / DataTable / Card grid / chart

- `Table` — static, small, no interaction on the data itself.
- `DataTable` (ours, TanStack Table over Mantine's `Table`) — the instant
  sorting, filtering, pagination, or selection appears. Do not grow a `Table`
  into one by hand.
- `Card` grid — the record is visual or has few shared attributes; a table of
  it would be mostly empty columns.
- `AreaChart` / `BarChart` / `Sparkline` from `@mantine/charts` — the trend or
  comparison is the point. If the user came for exact values, they came for a
  table; a chart plus a table is often the honest answer.

Every one of these still needs all four states (loading / empty / error /
success). `EmptyState` is not optional decoration; a blank region is a bug.

### Restraint inside a list

A record on its own page and the same record as a row want different drawings.
The page is read once, in full; the row is scanned, one column at a time,
against twenty-six others. So a component that is right on a detail page —
a filled `Badge`, a `Progress` bar, an avatar coloured from the name — is often
wrong in a table, where it is painted once per row for a fact that is read once.

The rules that follow from that:

- **Colour belongs to one column.** Choose the column a reader must catch out of
  the corner of their eye and make it the only coloured thing in the table. A
  second coloured column turns the first back into noise.
- **Rank with weight and dimming, not with fills.** `fw={500}` on the tier that
  matters and `c="dimmed"` on the one that does not carries the same ladder as a
  row of pills, without the paint.
- **A ratio is two numbers.** `221 / 240` with the denominator dimmed says what
  a bar says, in a fraction of the ink. Keep the bar for the detail page.
- **Nothing on a row that the row does not need.** A second line under a name,
  for a string the filter cannot even match, is drawn twenty-seven times and
  read none.

Write both drawings when you add a resource: a `Badge` for the detail page and
a plain-text label for the column. `src/pages/Customers/PlanBadge.tsx` and
`HealthBadge.tsx` each export the pair, and `customer-columns.tsx` records why.

## When nothing here fits

Say so in `DECISIONS.md` and explain the trade. A deviation with a recorded
reason is fine — that is what the file is for. A deviation nobody wrote down
becomes the next agent's precedent.

## How this is checked

- `.claude/skills/use-mantine/mantine-capabilities.md` carries `Use when:` and
  `Instead:` for every component family this app uses, and `capability-lint`
  fails the build when an entry loses either — or when a component enters the
  source with no entry at all. A new control cannot land without selection
  guidance attached to it.
- `skill-lint` grades the instructions themselves: a skill or a principle that
  still describes the styling system this app dropped fails the build, because
  an agent following it writes code `ui-lint` then rejects.
- The evaluator rubric's **Control fit** row scores whether the chosen control
  suited the job, not merely whether it came from Mantine. That row is judged,
  not linted: no static rule can tell a well-chosen `Tabs` from a badly-chosen
  one.
