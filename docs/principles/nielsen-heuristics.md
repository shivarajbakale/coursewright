<!-- principle:nielsen-heuristics:v2 -->
<!-- Stamped from the shared principles source by stamp-principles.mjs. Edit the source and re-stamp: a hand edit fails principles-drift. -->

# Nielsen's 10 usability heuristics

This is the lingua franca for "why does this feel right (or wrong)?" The
heuristics are general; the platform section at the end of this document maps
each one to the component or pattern in this app that implements it. When you
change the UX of a screen, walk this list. When you're unsure whether a flow is
"premium enough", this is the yardstick.

> Source: Jakob Nielsen, "10 Usability Heuristics for User Interface
> Design" (1994, revised 2020). Public domain.

## 1. Visibility of system status

The user should always know what the system is doing.

- Skeletons while data is loading — never a blank region.
- A toast for every async mutation (create / update / delete).
- A spinner only when an action takes > 300ms — anything faster shows a
  disabled button with a pending label instead.
- A subtle refresh indicator when data is re-fetching in the background.
- **Failure mode:** a button that does nothing on click. Never. If a click has
  no immediate effect, it's not wired.

## 2. Match between system and the real world

Speak the user's language. Don't use internal jargon.

- Resource names are the user's nouns ("Customers", "Orders", "Invoices"), not
  `Entity` or `Tenant`. If the user-facing term and the API term differ, the
  API term wins internally; the UI term wins externally.
- Dates are formatted for people (`Sep 4, 2026`), never raw ISO.
- Money goes through `Intl.NumberFormat` with the currency, in tabular figures
  wherever it lines up in a column.
- **Failure mode:** "Resource creation failed: 422 unprocessable_entity". Map
  it to a human sentence: "Please enter a name".

## 3. User control and freedom

Support undo. Never trap the user.

- Every destructive action has a confirmation modal that names the object
  ("Delete 'Acme'?").
- Trivial reversible actions (archive, toggle) update optimistically and offer
  undo in a toast.
- Back and forward restore scroll position and form state.
- **Failure mode:** "Submit" with no Cancel. If the dialog closes on Esc, the
  user has a way out.

## 4. Consistency and standards

Same words, same actions, same order. Every screen.

- The page frame is the same on every page. Never bypass it.
- The primary action lives in one place, on every page.
- Cancel is always a secondary / plain button, never a second primary.
- Destructive buttons always carry the destructive tone, and sit at the end of
  their section.
- **Failure mode:** two pages that put the primary action in different
  corners. Pick one, document it, follow it everywhere.

## 5. Error prevention

Catch errors before they happen. Constrain inputs.

- Validation schemas carry `min` / `max` / `email` / `url` constraints.
- Irreversible actions go through the design system's confirm modal, never the
  native browser `confirm()`.
- Submit is disabled while pending — no double-submit.
- Inputs declare their type (`email`, `number` with `min`) so the device offers
  the right keyboard.
- **Failure mode:** a free-text field for an email that accepts
  "not-an-email".

## 6. Recognition rather than recall

Show, don't make the user remember. Make options visible.

- A row's actions live in a menu on the row, not behind a modal that asks
  "what should happen to this row?".
- Placeholders are *examples*, not labels. The label is always visible.
- Recent items at the top of a search.
- Breadcrumbs or a back action for deep navigation.
- **Failure mode:** a blank textarea with no hint about what to put in it.

## 7. Flexibility and efficiency of use

Shortcuts for power users. Don't hide the common path.

- Keyboard: `Esc` closes overlays, `Enter` submits, arrows move through lists.
- `⌘S` / `Ctrl+S` saves a form where saving is the job.
- Bulk actions on collections (select N rows → archive all).
- **Failure mode:** a flow that takes five clicks when a shortcut could take
  one. Build the shortcut with the click path, not later.

## 8. Aesthetic and minimalist design

Every element earns its place. Remove what doesn't.

- A page fits its job in a short scroll — see
  [density-and-disclosure.md](density-and-disclosure.md) for the budget.
- Charts: at most 5 series.
- Modals: one primary action, one cancel.
- Empty states: 3 lines max + one CTA.
- **Failure mode:** a dashboard with 12 widgets. Pick the 4 that matter.

## 9. Help users recognize, diagnose, recover from errors

Error messages say what happened, why, and what to do next.

- Field errors render inline under the field.
- Cross-cutting errors ("session expired") render once, as a toast or a single
  banner — see [microcopy.md](microcopy.md).
- **Failure mode:** a "Something went wrong" toast. "Couldn't save changes —
  check your connection and try again."

## 10. Help and documentation

The user shouldn't need docs to use the app, but docs help.

- Tooltips on icon-only buttons, with an `aria-label` as well.
- Helper text under inputs that aren't self-explanatory.
- Empty states say what will appear and how to make it appear.
- **Failure mode:** an advanced feature with no discoverable entry point.

## How to use this list

When you're designing a new screen:

1. Pick the heuristics most relevant to your screen (settings pages care about
   #3, #6, #10; data tables care about #2, #8).
2. For each, check whether your design satisfies it.
3. If not, fix the design or note the deviation in `DECISIONS.md`.

When you're reviewing someone else's screen:

1. Walk the list top-down.
2. For each violated heuristic, name it ("#5 violated — submit not disabled
   while pending") and propose a fix.
3. Don't ship if more than 2 are violated on a critical flow.

This doc informs but does not enforce. The mechanical counterparts are the
`ux-prepass` skill and the accessibility gate named in the platform section.

## On this platform — React + Mantine

| Heuristic | Where it shows up in this app |
| --- | --- |
| 1. System status | `Skeleton` while loading; `toast` (`src/lib/notify.ts`, `@mantine/notifications`) for every mutation; `useX().isFetching` for a quiet refresh indicator |
| 2. Real world | `format(date, "MMM d, yyyy")`; `Intl.NumberFormat` with `tabular-nums` |
| 3. Control and freedom | the Danger Zone pattern in `add-settings`; the undo toast in `docs/UX.md` "Modal vs inline confirm"; never `replaceState` on form changes |
| 4. Consistency | every page renders inside `PageShell`; primary action bottom-right of a form; destructive buttons are `color="red"` in the Danger Zone |
| 5. Error prevention | zod schemas; `modals.openConfirmModal` from `@mantine/modals`; `<TextInput type="email">`, `<NumberInput min={1} />` |
| 6. Recognition | `Menu` on the row; the label above the input; `Breadcrumbs` for deep routes |
| 7. Efficiency | the ⌘K palette (`command-palette.tsx`); bulk actions on the data table |
| 8. Minimalism | the shell is a fixed viewport and pages scroll inside `PageShell` |
| 9. Recovery | `getErrorMessage(error)` returns a sentence; `form.setError("field", { message })` renders under the field |
| 10. Help | the input's `description` prop for helper text; a `Tooltip` plus `aria-label` on every `ActionIcon` |

The accessibility gate is `make a11y` (axe violations).
