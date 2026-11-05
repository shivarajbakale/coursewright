# Mantine capability map

The routing table behind the `plan-feature`, `add-page`, `add-form` and
`add-ui-component` skills. Read a row by **what you want the user to be able to
do**; it names the component to import, the package it comes from, the
neighbour agents reach for by mistake, the slice of this repo that already does
it, and the thing that bites.

Verified against **@mantine/core 9.6.0** on **2026-09-04**.

## How to read this file

- **`Use when:` / `Instead:` is the whole point.** Every gate in this repo
  checks that a screen was built correctly; none of them check that it was
  built out of the right parts. `Instead:` names the component next door and
  the question that separates the two.
- **`Ours:` is a reference slice, not a citation.** Open it and copy the shape.
  A row that reads *(not wired…)* is a component this repo documents but does
  not yet use — the pattern is decided, the code is not written. Most of
  `@mantine/core` is in that state here on purpose: the decision is written
  before the first call site, not after it.
- Cross-family decisions — tooltip vs popover vs modal, tabs vs rail vs route,
  select vs autocomplete — live in `docs/principles/component-selection.md`.
  This file is per-family; that file is the choice between families.
- **Mantine components are not wrapped here.** There is no kit layer between
  the app and the library: pages import `@mantine/core` directly, and
  `src/components/` holds only this product's own composites. `src/theme.ts` is
  where a default changes for everybody.

This file is a checked artifact, not prose. `npm run capability-lint` fails the
build when an entry loses a field, names a component the installed packages do
not export, names a package that is not a dependency, points at a file that
moved, or leaves a component the source imports undocumented. It also fails when
`@mantine/core` ships a component this file has neither routed nor refused, so
the map covers the whole library rather than only the parts already used.
`npm run doc-links` fails when the sources below stop being Mantine's own docs
or go stale.

## The cascade contract

Mantine owns **colour, border, radius, elevation, typography, state and
layout** — everything. There is no second styling system to draw a boundary
against, and `npm run ui-lint` fails the build on a utility class anywhere in
`src/` or `.storybook/`, with no debt list left to forgive an exception.

- A colour is `c="dimmed"`, `color="red"` or `var(--mantine-color-*)`. Never a
  hex, never a utility class.
- A surface is `Paper` / `Card`, never a `div` painted to look like one.
- A row is `Group`, a column is `Stack`, a grid is `SimpleGrid` or `Grid`, and
  everything else is `Box` with a style object. Spacing is Mantine's scale
  (`gap="md"`, `p="lg"`) everywhere, page layout included.
- A rule an inline style cannot express — a media query, a `:hover` on a
  non-Mantine element — goes in a CSS module beside its component.
- Anything the theme should own goes in `src/theme.ts` — `components.X.defaultProps`
  — not into every call site.

## The map

### Actions

#### `Button` — @mantine/core

- **Use when:** A click causes something to happen — submit, open, run, confirm.
- **Instead:** `Anchor` or `component={Link}` when the click goes somewhere;
  a button that navigates must still be an anchor underneath. `ActionIcon` when
  the label would be an icon alone.
- **Ours:** `src/components/ErrorBoundary.tsx`, `src/pages/Auth/LoginPage.tsx`
- **Gotcha:** Icons go in `leftSection` / `rightSection`, not as children — the
  v6 `leftIcon` prop is gone. The submit button of a form carries
  `data-submit`, which is what the UI probe's B3 rule looks for.

#### `ActionIcon` — @mantine/core

- **Use when:** The control is an icon and nothing else — a toolbar toggle, a
  row action, a close affordance.
- **Instead:** `Button` with a `leftSection` the moment the action deserves a
  word; icon-only is for actions the user already knows.
- **Ours:** `src/components/topbar.tsx`, `src/components/nav-main.tsx`
- **Gotcha:** It has no accessible name of its own. Every one needs
  `aria-label`, and a `Tooltip` around it as well — the tooltip serves sighted
  pointer users, the label serves everyone else, and neither substitutes.

#### `UnstyledButton` — @mantine/core

- **Use when:** The trigger is a composed thing — an avatar chip, a table
  header cell, a sidebar row — and no button skin should be painted.
- **Instead:** `Button` variants first. Reach here only when a variant would
  have to be undone.
- **Ours:** `src/components/nav-user.tsx`, `src/components/data-table.tsx`
- **Gotcha:** Unstyled means unstyled except the focus ring; it is still a real
  `<button>`, so it must not contain another interactive element.

#### `CloseButton` — @mantine/core

- **Use when:** A dismiss affordance on a surface this app builds itself — a
  banner it owns, the header of a custom panel.
- **Instead:** `ActionIcon` for any other icon action. `Modal`, `Drawer` and
  `Notification` render their own; adding a second one gives the keyboard two
  ways out and the screen reader two names for the same thing.
- **Ours:** *(not wired — every dismissable surface here is a Mantine one that
  ships its own)*
- **Gotcha:** It has no accessible name — set `aria-label`. `iconSize` is
  ignored the moment you pass a custom `icon`.

#### `CopyButton` — @mantine/core

- **Use when:** The user needs a value they cannot reasonably retype — an API
  key, an invoice id, a share link.
- **Instead:** a `Button` with your own clipboard call only when the copied
  state has to outlive the control; this one resets on a timer.
- **Ours:** *(not wired — no surface here shows a copyable secret yet)*
- **Gotcha:** Its child is a render function (`{({ copied, copy }) => …}`), not
  an element. `timeout` defaults to 500ms, which reads as a flicker rather than
  a confirmation — 1000–2000 is the honest range, and the label has to change,
  not just the colour.

#### `FileButton` — @mantine/core

- **Use when:** Choosing a file is an action rather than a field — "Replace
  avatar", "Import CSV".
- **Instead:** `FileInput` when the file belongs to a form and the chosen
  filename has to stay on screen beside the other values.
- **Ours:** *(not wired — nothing here uploads yet)*
- **Gotcha:** Its child is a render function whose props you spread onto your
  own `Button`. A file input cannot be controlled, so clearing a selection needs
  `resetRef` — without it, picking the same file twice fires nothing at all.

#### `ActionBar` — @mantine/core

- **Use when:** Rows are selected and the actions apply to the selection — the
  bulk bar that rises over a table.
- **Instead:** a row's own `Menu` when the action applies to one record; a
  toolbar above the table when the actions are always available.
- **Ours:** *(not wired — nothing here selects rows in bulk yet)*
- **Gotcha:** It is `Affix` + `Transition` + `Paper` in a portal, so it leaves
  the page's stacking context and needs `aria-label` naming what the actions
  apply to. It does not close on Escape unless you set `closeOnEscape`, and it
  unmounts when closed — `keepMounted` if it holds state between openings.

### Text

#### `Text` — @mantine/core

- **Use when:** Any run of body copy, a caption, a value, a secondary line.
- **Instead:** `Title` for anything that is a heading in the document outline.
- **Ours:** `src/components/stat-card.tsx`, `src/pages/Dashboard.tsx`
- **Gotcha:** Secondary copy is `c="dimmed"`, not a colour of its own, and
  emphasis is `fw={500}` / `fw={600}` — ui-probe module C fails a view carrying
  more than five distinct size × weight pairs, so reach for the existing pair
  before inventing one.

#### `Title` — @mantine/core

- **Use when:** The heading of a page, a panel or a section.
- **Instead:** `Text fw={600}` when the line looks like a heading but is not one
  in the outline — a label above a value, for instance.
- **Ours:** `src/components/page-shell.tsx`, `src/pages/Auth/AuthLayout.tsx`
- **Gotcha:** `order` sets the tag (`order={1}` is `<h1>`) and `size` sets the
  look; do not skip a level to get a smaller heading. Every page needs exactly
  one `h1` — the probe waits for it before it measures anything.

#### `Anchor` — @mantine/core

- **Use when:** The text takes the user somewhere.
- **Instead:** `Button variant="subtle"` when the click acts rather than
  navigates.
- **Ours:** `src/pages/Auth/LoginPage.tsx`
- **Gotcha:** In-app links are `component={Link} to="…"` so TanStack Router
  handles them; a bare `href` reloads the application.

#### `Code` · `Kbd` — @mantine/core

- **Use when:** Showing a literal — an identifier, an error string (`Code`) or
  a key the user should press (`Kbd`).
- **Instead:** `Text ff="monospace"` never; the token background is what makes
  a literal read as one.
- **Ours:** `src/components/ErrorBoundary.tsx`, `src/components/command-palette.tsx`
- **Gotcha:** `Code block` is a `<pre>`; inline `Code` inside a paragraph must
  not wrap block content.

#### `List` — @mantine/core

- **Use when:** Real prose lists — steps, requirements, the bullets in a help
  page.
- **Instead:** `Stack` for a column of components, `DataList` for one record's
  fields, `Table` for many records. A list of destinations is `NavLink` rows.
- **Ours:** *(not wired — no prose surface here yet)*
- **Gotcha:** `List.Item` is required; a bare `<li>` loses the spacing and the
  icon slot. `icon` on the `List` is the default for every item and `icon` on an
  item overrides it — replacing the bullet does not stop it being a `<ul>`, so
  do not use one for layout.

#### `Blockquote` — @mantine/core

- **Use when:** A quotation with an attribution — a testimonial, an excerpt from
  a customer's message.
- **Instead:** `Alert` when the app is the one talking; `Paper` when the box is
  only a box.
- **Ours:** *(not wired — nothing here quotes anyone)*
- **Gotcha:** `cite` is the attribution line, not a URL. Leave `color` alone
  unless the quote carries a status — a coloured quote reads as a state the
  reader then looks for a meaning for.

#### `Mark` · `Highlight` — @mantine/core

- **Use when:** Showing *why* a result matched — the search term inside the row
  it returned.
- **Instead:** `Text fw={600}`, never: emphasis and "this is your match" are
  different claims, and `<mark>` is the one the browser and the screen reader
  already understand.
- **Ours:** `src/pages/TeamPage.tsx` (the member rows mark what the search
  matched)
- **Gotcha:** `Highlight` matches case- and accent-insensitively across the
  whole string and marks every occurrence; `wholeWord` stops "the" lighting up
  "theme", and an empty highlight string is ignored rather than matching
  everything. `Mark` is the manual form, for when you already know the span.
  The colour is a theme decision, already made in `src/theme.ts`: Mantine's mark
  is yellow, which on this ground outshouts the row the reader was looking for.
  Two traps in changing it — `Highlight` passes its own colour down, so a
  default on `Mark` never arrives; and `--mantine-color-brand-light` resolves to
  opaque **black** here, because Mantine derives that variable by alpha-ing the
  palette and this palette is `oklch`, which its parser does not read. The
  default mixes `--mantine-color-brand-filled` instead.

#### `Typography` — @mantine/core

- **Use when:** Rendering HTML this app did not author — a changelog, a help
  article, markdown that arrived from an API.
- **Instead:** `Text` and `Title` for anything you compose yourself. Mantine
  ships no global typography styles on purpose; this is the opt-in, not a reset.
- **Ours:** *(not wired — every string here is composed, not injected)*
- **Gotcha:** It styles its descendants, so it wraps the injected HTML and
  nothing else — wrap a page in it and it restyles every component inside.
  It paints content; it does not sanitise it.

### Form fields

#### `TextInput` · `Textarea` — @mantine/core

- **Use when:** Free text, one line or many.
- **Instead:** `Select` / `Autocomplete` whenever the value is one of a known
  set — never make someone type a value the app already has.
- **Ours:** `src/pages/Auth/LoginPage.tsx`, `src/pages/Customers/customer-form.tsx`
- **Gotcha:** `label`, `description` and `error` are props, not siblings —
  Mantine wires the `for`/`aria-describedby`/`aria-invalid` links itself, and a
  hand-rolled `<label>` beside the input breaks them. With react-hook-form,
  spread `{...register('field')}` and pass
  `error={errors.field?.message}`.

#### `NumberInput` — @mantine/core

- **Use when:** A quantity the user types or steps — seats, a limit, a price.
- **Instead:** `TextInput type="number"`, never: it returns a string, accepts
  `1e5` and `--3`, and its native spinner cannot be styled or removed.
- **Ours:** `src/pages/Customers/customer-form.tsx`
- **Gotcha:** `onChange` gives `number | string` — the string is what an
  in-progress entry like `"-"` or `""` looks like, so a handler that assumes a
  number writes `NaN` into form state. Pair `min`/`max` with
  `clampBehavior="strict"`, or the field only clamps on blur and a paste can
  submit an out-of-range value.

#### `PasswordInput` — @mantine/core

- **Use when:** A password or any secret the user should be able to reveal.
- **Instead:** `TextInput type="password"` never — you lose the toggle and its
  label.
- **Ours:** `src/pages/Auth/SignupPage.tsx`
- **Gotcha:** The reveal button needs a name:
  `visibilityToggleButtonProps={{ 'aria-label': 'Show password' }}`.

#### `PinInput` — @mantine/core

- **Use when:** A short fixed-length code — OTP, an invite code.
- **Instead:** `TextInput` when the length varies or the value is copied in.
- **Ours:** `src/components/_overview/Widgets.stories.tsx`
- **Gotcha:** It renders one input per cell, so it has no single label — give
  it `aria-label`, and set `oneTimeCode` so the OS offers the SMS code.

#### `Select` — @mantine/core

- **Use when:** One value from a fixed list of roughly five to ten.
- **Instead:** `Radio.Group` below five when the options deserve description,
  `Autocomplete`/`Combobox` above ten or when the user knows the name and typing
  beats scanning, `SegmentedControl` when the choice re-renders a view.
- **Ours:** `src/pages/TeamPage.tsx`
- **Gotcha:** `data` values are **strings only** — a numeric id must be
  stringified going in and parsed coming out. `searchable` is a prop, not a
  different component. And **mounting one under jsdom costs ~25 seconds**:
  it carries a `Combobox`, whose floating layer keeps the event loop busy in a
  DOM with no layout, so the cost lands on every `await` in the test and on
  teardown, not on `render()`. It is a test-environment cost only — the
  browser is fine, and `ui-probe` runs in real Chromium — but a page that
  mounts one is a page whose jsdom tests you will not wait for. Where the
  choice is four short options or fewer, `SegmentedControl` is both the better
  control and the cheap one.

#### `Checkbox` — @mantine/core

- **Use when:** Independent binary choices where zero or many may be on, and row
  selection in a table.
- **Instead:** `Switch` when the change applies the instant it flips.
- **Ours:** `src/components/_overview/Primitives.stories.tsx`
- **Gotcha:** `label` is a prop; `indeterminate` is the header-row state and is
  visual only — the value it reports is still `checked`.

#### `Radio` — @mantine/core

- **Use when:** Exactly one of two to five options, and the options need words.
- **Instead:** `Select` past five, `SegmentedControl` when the options are short
  and switch a view.
- **Ours:** `src/pages/Settings.tsx`
- **Gotcha:** `Radio.Group` owns `value`/`onChange` and the group label; a bare
  `Radio` outside one has no name and no keyboard arrow behaviour.

#### `Switch` — @mantine/core

- **Use when:** The change takes effect immediately.
- **Instead:** `Checkbox` when the value is submitted with a form.
- **Ours:** `src/pages/Settings.tsx`
- **Gotcha:** A switch beside a Save button is a broken promise. Persist on
  change, and say so — a toast, or an optimistic write with undo.

#### `SegmentedControl` — @mantine/core

- **Use when:** Two to five short peer options that immediately change what is
  displayed — a range, a density, a view mode.
- **Instead:** `Tabs` when each option has its own panel of content,
  `Radio.Group` when the choice is submitted rather than applied.
- **Ours:** `src/pages/Dashboard.tsx`, `src/pages/InboxPage.tsx`
- **Gotcha:** `data` values are strings, and the control does not scroll — past
  five segments it squeezes rather than wraps. Two things about it are theme
  decisions this app has already made, both in `src/theme.ts`: a label neither
  wraps nor widens the control, so the *last* thing in a label is what
  disappears (and in a filter row the last thing is the count); and the track's
  own colour in dark mode is Mantine's `dark[8]`, which this theme spends on
  the page itself — left alone, the control comes out exactly the colour of its
  background and reads as loose text with hairlines between the words. It is
  grounded on `--app-control` instead, which clears both the page and a Card.
  Probe rule `C7` fails any Mantine surface that lands back on its own ground.

#### `DatePickerInput` — @mantine/dates

- **Use when:** A date or a date range in a form.
- **Instead:** `TextInput` with a mask never; `DateTimePicker` when the time
  matters; `TimeInput` for a time alone.
- **Ours:** `src/components/_overview/Widgets.stories.tsx`
- **Gotcha:** Since Mantine 8 the value is a **`'YYYY-MM-DD'` string**, not a
  `Date` — a `new Date()` handed to `value` is a type error and a runtime
  surprise. The package needs `dayjs`, which is a dependency here already.

#### `Autocomplete` — @mantine/core

- **Use when:** The value is free text and the suggestions only make it faster —
  a city, a job title, a tag the user may well invent.
- **Instead:** `Select searchable` when the value **must** be one of the options:
  Autocomplete does not enforce them, and it is not a searchable select however
  much it looks like one. `TagsInput` when there is more than one value.
- **Ours:** *(not wired — every choice here is from a known set)*
- **Gotcha:** The value is a string and anything typed is legal, so the
  validation is yours. It has no "nothing found" state by design — an unmatched
  string is a valid answer here, not an error.

#### `MultiSelect` — @mantine/core

- **Use when:** Several values from a fixed list — roles, labels, recipients.
- **Instead:** `TagsInput` when the user may invent a value; `Checkbox.Group`
  under about six options, where seeing them all beats opening a dropdown.
- **Ours:** *(not wired — no field here takes more than one value yet)*
- **Gotcha:** The value is `string[]`, so numeric ids are stringified going in
  and parsed coming out. It carries a `Combobox`, which means it inherits
  `Select`'s jsdom cost — a page that mounts one is a page whose jsdom tests you
  will wait on. `maxValues` caps the selection and `hidePickedOptions` stops the
  list offering what is already chosen.

#### `TagsInput` — @mantine/core

- **Use when:** The user creates the values — free-form tags, a list of emails
  to invite.
- **Instead:** `MultiSelect` the moment the set is fixed. A tag the backend has
  never heard of is a support ticket.
- **Ours:** `src/pages/TeamPage.tsx` (the invite dialog takes a list of
  addresses)
- **Gotcha:** Values are strings, committed on Enter or on a suggestion click —
  `acceptValueOnBlur` decides whether a half-typed tag survives losing focus, and
  `splitChars` turns a pasted comma list into tags. Duplicates are dropped
  silently unless you pass `allowDuplicates` or your own `isDuplicate`.

#### `NativeSelect` — @mantine/core

- **Use when:** The platform's own picker is the better control — a short static
  list on a phone, a field the OS should be able to autofill.
- **Instead:** `Select` as soon as the list wants search, rich options, a clear
  button or an empty state.
- **Ours:** *(not wired — the pickers here are `Select` and `SegmentedControl`)*
- **Gotcha:** It is a real `<select>`: options cannot be styled, and passing
  `children` (raw `<option>`s) makes `data` ignored entirely. A placeholder has
  to be a real option, so make it disabled or it becomes a submittable value.

#### `Chip` — @mantine/core

- **Use when:** Filters the user toggles in place — the status row above a list.
- **Instead:** `SegmentedControl` when exactly one can be on and it switches the
  view; `Checkbox` when the value is submitted with a form.
- **Ours:** *(not wired — the filters here are a `SegmentedControl`)*
- **Gotcha:** `Chip.Group` owns the value and whether `multiple` is allowed; a
  lone `Chip` is an uncontrolled checkbox wearing a label. Wrapping one in a
  `Tooltip` needs `refProp="rootRef"` on the tooltip, because the chip's root is
  not its input.

#### `Combobox` — @mantine/core

- **Use when:** The picker this app needs is none of the three above — options
  fetched as the user types, options that render as rows, a target that is not
  an input.
- **Instead:** `Select`, `MultiSelect` and `Autocomplete` first. They are this
  component with the decisions already made; hand-rolling one is how the ARIA
  gets lost.
- **Ours:** *(not wired — `src/components/command-palette.tsx` is the one custom
  picker here and it is built on Spotlight)*
- **Gotcha:** `useCombobox()` returns the store and it has to be passed to
  `store` — nothing opens on its own. You own the filtering, the empty state and
  calling `updateSelectedOptionIndex` whenever the option list changes; skip that
  and the keyboard highlights a row that no longer exists.

#### `ComboboxPopover` — @mantine/core

- **Use when:** A picker hangs off a button rather than a field — a "Group by"
  control in a toolbar.
- **Instead:** `Menu` when the items are actions rather than a value; `Select`
  when there is a field for the answer to live in.
- **Ours:** *(not wired — the toolbars here choose with `SegmentedControl`)*
- **Gotcha:** `ComboboxPopover.Target` clones a single child that must accept a
  ref. The trigger still has to say what is selected: a button reading "Group by"
  alone hides the current value from everyone who cannot open it.

#### `TreeSelect` — @mantine/core

- **Use when:** The options are a hierarchy and the user picks from inside it —
  a category, a folder, an org unit.
- **Instead:** `Select` when a flat list would do, which it usually would;
  `Cascader` when drilling column by column reads better than expanding in place.
- **Ours:** *(not wired — nothing here is hierarchical)*
- **Gotcha:** Same data rules as `Tree`: a memoized array whose every node has a
  unique `value`. `checkStrictly` decides whether checking a parent takes its
  children with it, and in `single`/`multiple` mode only leaves can be selected.

#### `Cascader` — @mantine/core

- **Use when:** A path through hierarchical data, chosen column by column —
  region, then country, then city.
- **Instead:** `TreeSelect` when the shape matters more than the path; two
  `Select`s when there are exactly two levels.
- **Ours:** *(not wired — nothing here is hierarchical)*
- **Gotcha:** The value is the **ordered path**, not a leaf id. Only leaves are
  selectable by default — clicking a parent just opens the next column — and the
  columns need horizontal room, which is what decides whether it fits the surface
  at all.

#### `PillsInput` · `Pill` — @mantine/core

- **Use when:** Building a multi-value field this library does not ship — tokens
  that carry an avatar, filters whose values are objects.
- **Instead:** `MultiSelect` / `TagsInput`, which are this pair with the logic
  already in them. `Badge` when the token cannot be removed — a pill implies an
  X, and one that does nothing is a broken promise.
- **Ours:** *(not wired — no custom token field here)*
- **Gotcha:** `PillsInput` renders its children and nothing else: no filtering,
  no keyboard, no state. `PillsInput.Field` is the real input and takes the
  label; without a `label` it needs `aria-label`.

#### `Slider` — @mantine/core

- **Use when:** An approximate value on a range whose ends mean something — an
  opacity, a threshold with a live preview.
- **Instead:** `NumberInput` whenever the exact number matters. Nobody drags to
  37.
- **Ours:** *(not wired — no setting here is continuous)*
- **Gotcha:** The label appears only while dragging unless `labelAlwaysOn`,
  which leaves the value invisible on touch. Marks are placed by value rather
  than width, and `restrictToMarks` snaps to them. Anything expensive belongs in
  `onChangeEnd`; `onChange` fires all the way through the drag.

#### `Rating` — @mantine/core

- **Use when:** Capturing or showing a star score.
- **Instead:** `Progress` or a plain number when the figure is computed rather
  than given — stars on a metric are decoration.
- **Ours:** *(not wired — nothing here is rated)*
- **Gotcha:** `readOnly` is what stops a displayed rating looking clickable, and
  `fractions` is what lets 4.5 render as 4.5 instead of snapping. In an
  uncontrolled form it needs `name`, or the value never reaches `FormData`.

#### `ColorInput` · `ColorPicker` · `ColorSwatch` — @mantine/core

- **Use when:** The user picks a colour that is theirs — a label colour, a
  workspace accent.
- **Instead:** a fixed row of `ColorSwatch` buttons whenever the palette belongs
  to the product. Free colour choice is how an app ends up with white text on
  yellow.
- **Ours:** *(not wired — colour here comes from the theme)*
- **Gotcha:** The value is a string in the `format` you asked for, and the alpha
  slider only appears for `hexa`, `rgba` and `hsla`. Persist on `onChangeEnd`;
  `onChange` fires through the whole drag. Whatever they pick still has to pass
  contrast against the surface it lands on, and nothing here checks that for you.

#### `AngleSlider` — @mantine/core

- **Use when:** The value is a direction — a gradient angle, a rotation.
- **Instead:** `NumberInput` with a degree suffix when the number is typed more
  often than dragged.
- **Ours:** *(not wired — nothing here has an angle)*
- **Gotcha:** It is 0–360 with no label of its own: set `aria-label`, and use
  `formatLabel` to say the unit out loud. `restrictToMarks` snaps to the marks
  you define.

#### `FileInput` — @mantine/core

- **Use when:** A file is one field among others — an attachment beside the rest
  of the form.
- **Instead:** `FileButton` when picking is a standalone action; a real drop zone
  when dragging is the primary gesture (`@mantine/dropzone` is not installed
  here — adding it is a decision, not a detail).
- **Ours:** *(not wired — nothing here uploads yet)*
- **Gotcha:** The value is a `File` (or `File[]` with `multiple`), never a path,
  so it does not round-trip through form state as a string. A custom
  `rightSection` displaces the clear button. `accept` is a hint to the picker,
  not a guarantee — check type and size yourself.

#### `JsonInput` — @mantine/core

- **Use when:** The user edits real JSON — a webhook payload, a config blob.
- **Instead:** `Textarea` when the text merely looks structured; a real editor
  when it is code with more than a screen of it.
- **Ours:** *(not wired — nothing here takes raw JSON)*
- **Gotcha:** `validationError` is what makes bad JSON visible and `formatOnBlur`
  rewrites what they typed — do not also reformat in state, or the caret jumps
  mid-edit. A custom `deserialize` **must throw** on invalid input; returning
  `undefined` reads as valid.

#### `MaskInput` — @mantine/core

- **Use when:** The format is fixed and typing it is the work — a card expiry, a
  licence key.
- **Instead:** `TextInput` with validation when the format varies by locale or
  by record. A mask that fights a paste costs more than the error message it
  saved.
- **Ours:** *(not wired — no field here has a fixed shape)*
- **Gotcha:** In the pattern `9` is a digit and `a` a letter, and `?` marks
  everything after it optional. The mask has to be a stable reference — define it
  outside render, or the input remounts on every keystroke and the caret jumps
  to the end.

#### `Fieldset` — @mantine/core

- **Use when:** A form has a group that deserves its own legend — the billing
  address inside a checkout.
- **Instead:** a `Title` above a `Stack` when the grouping is only visual. A
  fieldset is a claim about the form's structure, not a box.
- **Ours:** `src/pages/Customers/customer-form.tsx` (freezes every field while
  the create is in flight)
- **Gotcha:** `disabled` disables every control inside it in one prop, which is
  the cheapest honest way to freeze a form while it submits.
  `variant="unstyled"` keeps the semantics without the border.

#### `Input` · `InputBase` — @mantine/core

- **Use when:** Building a field this library does not ship — a currency box, a
  third-party control that still has to wear this app's label, description and
  error.
- **Instead:** the real field every other time. Mantine's own documentation says
  in bold that `Input` was not designed to be used directly; `TextInput` is
  `Input` plus everything you would otherwise re-add.
- **Ours:** *(not wired — every field here is a real one)*
- **Gotcha:** `Input` has no label, description or error of its own — that is
  `Input.Wrapper`, and `InputBase` is the two already joined and polymorphic
  (`component={…}`). A hand-rolled `<label>` beside an `Input` breaks exactly the
  `for` / `aria-describedby` / `aria-invalid` wiring `Input.Wrapper` exists to
  write.

### Feedback

#### `Alert` — @mantine/core

- **Use when:** Standing state a region or a page must keep showing — a failed
  submit, a degraded service, a plan limit.
- **Instead:** the field's own `error` prop for one field's validation, a
  notification for something transient.
- **Ours:** `src/pages/Auth/LoginPage.tsx`
- **Gotcha:** Give it `title` and `icon`; colour alone is not a status for
  anyone who cannot see it. An alert that appears after a submit needs
  `role="alert"` to be announced.

#### `Notifications` · `notifications` — @mantine/notifications

- **Use when:** Confirming something that just finished, with an undo if the
  action was reversible.
- **Instead:** `Alert` whenever the user has to act on it later — a toast leaves,
  and it leaves fastest for the people reading slowest.
- **Ours:** `src/lib/notify.ts` (the wrapper), `src/components/theme-provider.tsx`
  (mounts the container)
- **Gotcha:** It is an imperative store, not a component you render: call
  `notify.success(…)` from anywhere, but `<Notifications />` must be mounted
  exactly once, which `ThemeProvider` does. Import the package's CSS or nothing
  appears.

#### `Skeleton` — @mantine/core

- **Use when:** The shape of the content is known and the data is on its way.
- **Instead:** `Loader` when there is no shape to promise; an empty state when
  the answer is "nothing", not "not yet".
- **Ours:** `src/components/stat-card.tsx`, `src/components/data-table.tsx`
- **Gotcha:** Carry `data-slot="skeleton"` on every one — the UI probe treats a
  view as unsettled until they are gone, so an untagged skeleton makes the probe
  measure a loading screen.

#### `Loader` — @mantine/core

- **Use when:** A short indeterminate wait with no layout to preserve — a route
  guard, an inline button state.
- **Instead:** `Skeleton` for content, `Progress` when the total is known.
- **Ours:** `src/components/auth/AuthGuard.tsx`
- **Gotcha:** A spinner alone is not an accessible status; give the wrapper
  `role="status"` and a label.

#### `Progress` — @mantine/core

- **Use when:** A known fraction — quota used, steps done, upload position.
- **Instead:** `Loader` when the total is unknown, `RingProgress` when the
  number is the content rather than a bar beside it.
- **Ours:** `src/components/stat-card.tsx`, `src/pages/Customers/customer-columns.tsx`
- **Gotcha:** `value` is 0–100, not 0–1. Multi-segment bars use the compound
  form (`Progress.Root` + `Progress.Section`); a bar without a nearby number is
  decoration.

#### `Badge` — @mantine/core

- **Use when:** A short status or category attached to a record.
- **Instead:** `Text size="xs" c="dimmed"` when it is a label rather than a
  status; a badge that never changes is noise.
- **Ours:** `src/pages/Customers/customer-columns.tsx`, `src/pages/BillingPage.tsx`
- **Gotcha:** Status must survive colour blindness — the word inside carries the
  meaning, `color` only reinforces it.

#### `Indicator` — @mantine/core

- **Use when:** Marking the thing it wraps as having something new — an unread
  count on a bell, a presence dot on an avatar.
- **Instead:** `Badge` when the status is beside the object rather than on it.
- **Ours:** `src/components/notifications-dropdown.tsx`
- **Gotcha:** It positions over its child, so the child needs a size. Hide it
  with `disabled`, not by conditionally rendering the wrapper — that remounts
  the child.

#### `LoadingOverlay` — @mantine/core

- **Use when:** A form or panel is submitting and its content should stay
  readable underneath.
- **Instead:** `Skeleton` while the first data loads — there is nothing to cover
  yet; `loading` on the `Button` when only the action is busy.
- **Ours:** `src/pages/Customers/customer-form.tsx`
- **Gotcha:** It needs a positioned parent (`Box pos="relative"`), and it
  disables nothing: everything underneath stays focusable and clickable from the
  keyboard. Pair it with `Fieldset variant="unstyled" disabled`, which takes the
  whole form out of the tab order in one prop — that pairing is what the
  customer form does.

#### `Notification` — @mantine/core

- **Use when:** A notification has to be rendered in place — a story, a preview
  in settings, a row in a notification list.
- **Instead:** `notify.*` from `src/lib/notify.ts` for real transient feedback.
  This component is the paint; the queue, the timer and the stacking are the
  `@mantine/notifications` package's.
- **Ours:** *(not wired — the toasts here go through the store)*
- **Gotcha:** `withCloseButton` renders a button with no name; pass
  `closeButtonProps={{ 'aria-label': 'Dismiss' }}`. Rendered inline it announces
  nothing — the region around it needs `role="status"`.

#### `RingProgress` · `SemiCircleProgress` — @mantine/core

- **Use when:** One completion figure *is* the content of a tile — a quota, a
  score, a health number.
- **Instead:** `Progress` in a row of metrics. Bars share a baseline and can be
  compared down a column; rings cannot, and a ring per row is a chart nobody can
  read.
- **Ours:** *(not wired — the dashboard's tiles carry sparklines and bars)*
- **Gotcha:** `sections` are percentages that must total 100 or less, and the
  label is a node you supply — an unlabelled ring is decoration. Both need an
  explicit `size` and `thickness`; neither fills its parent.

### Overlays

#### `Modal` — @mantine/core

- **Use when:** A short task with a beginning and an end that the page context
  helps with — one or two fields, a confirm.
- **Instead:** a **route** the moment the task is long, deep-linkable,
  expensive, or worth refreshing without losing; `Drawer` when the task is a
  side panel.
- **Ours:** `src/pages/Customers/CustomersPage.tsx`, `src/pages/TeamPage.tsx`
- **Gotcha:** Always controlled (`opened` / `onClose`) — pair it with
  `useDisclosure`. Focus moves to the element carrying `data-autofocus`; without
  that attribute it lands on the close button, and the first keystroke is lost.

#### `Drawer` — @mantine/core

- **Use when:** Secondary context alongside the page — a detail pane, a filter
  panel, the mobile form of a modal.
- **Instead:** `Modal` when the task interrupts, a route when it is the page.
- **Ours:** `src/pages/Customers/CustomersPage.tsx`
- **Gotcha:** Same API as `Modal`, including the focus trap. `position="bottom"`
  is the phone idiom; a right drawer on a narrow screen is a modal with extra
  steps.

#### `Menu` — @mantine/core

- **Use when:** A list of actions hanging off one trigger — a row's overflow, an
  account chip.
- **Instead:** `Select` when the list is a value rather than actions, `Popover`
  when the surface holds a form.
- **Ours:** `src/components/nav-user.tsx`, `src/components/account-menu.tsx`
- **Gotcha:** `Menu.Target` clones its child and needs a ref — wrap plain markup
  in `UnstyledButton` or `Box`. Destructive items get `color="red"` **and** a
  confirm; an irreversible action one click deep is a bug.

#### `Tooltip` — @mantine/core

- **Use when:** Naming an icon-only control, or adding a few passive words.
- **Instead:** visible helper text when the content is needed to succeed —
  tooltips do not exist for touch, and they do not survive scanning.
  `Popover` the moment anything inside is interactive.
- **Ours:** `src/components/nav-main.tsx` (the collapsed rail)
- **Gotcha:** The child must forward a ref, and the tooltip is *not* the
  accessible name — the control still needs `aria-label`.

#### `Popover` — @mantine/core

- **Use when:** A small surface with something interactive in it — a filter, a
  colour picker, a mini form — that the user can dismiss by clicking away.
- **Instead:** `Modal` when the user must finish or dismiss before continuing;
  `Tooltip` when the content is a few passive words; `HoverCard` when it is a
  passive preview.
- **Ours:** *(not wired — the shell's surfaces are menus and modals; compose
  `Popover.Target` + `Popover.Dropdown` and set `trapFocus`)*
- **Gotcha:** Hover-triggered surfaces cannot hold interactive content: the
  pointer has to travel there, and the surface closes on the way.

#### `HoverCard` — @mantine/core

- **Use when:** A rich, passive, entirely optional preview — a user card, a link
  preview.
- **Instead:** `Tooltip` for a few words, `Popover` for anything clickable.
- **Ours:** *(not wired — no surface here previews an entity yet)*
- **Gotcha:** It has no touch equivalent, so nothing inside it may be the only
  route to a fact or an action.

#### `Spotlight` · `createSpotlight` · `useSpotlight` — @mantine/spotlight

- **Use when:** A global launcher over commands and records, opened from
  anywhere with a shortcut.
- **Instead:** `Select searchable` when it fills a field rather than launching
  an action.
- **Ours:** `src/components/command-palette.tsx`
- **Gotcha:** Spotlight ships **no ARIA** — no `combobox` role, no
  `aria-activedescendant`, no `aria-selected`. Our palette supplies the pattern
  itself and therefore owns filtering, so the selected index it announces and
  the one Spotlight highlights are the same. Use `createSpotlight()` per
  instance rather than the global store when a story mounts more than one, and
  read the open state through that instance's `useSpotlight()`.

#### `modals` · `ModalsProvider` — @mantine/modals

- **Use when:** A confirm that does not deserve a component — delete, discard,
  leave.
- **Instead:** a real `Modal` when the surface has content of its own; **no
  dialog at all** when the action is reversible — apply it and offer undo in a
  notification.
- **Ours:** `src/pages/Customers/CustomerDetailPage.tsx`,
  `src/components/theme-provider.tsx` (mounts the provider)
- **Gotcha:** `modals.openConfirmModal` needs `ModalsProvider` above it or it
  silently does nothing. Name the object in the title — `Delete "Acme"?` — and
  set `confirmProps={{ color: 'red' }}`.

#### `Dialog` — @mantine/core

- **Use when:** Nothing here. It is a fixed corner panel with no focus trap, no
  overlay and no dismiss on outside click.
- **Instead:** `Modal` when the task interrupts, `Drawer` when it is a side
  panel, a notification when it is transient.
- **Ours:** *(not wired — and deliberately)*
- **Gotcha:** Mantine's own documentation says it is not accessible and most
  screen readers will not announce it. It has an entry here so the next reader
  stops at this row rather than discovering that after shipping it.

#### `Overlay` — @mantine/core

- **Use when:** Dimming a surface this app built itself — a locked card, a media
  frame with controls on top.
- **Instead:** `LoadingOverlay` when the reason is loading; `Modal`, which brings
  its own.
- **Ours:** *(not wired — the only dimmed surfaces here are modals)*
- **Gotcha:** `backgroundOpacity` changes the background colour, not CSS
  `opacity`, so children stay at full strength — that is the point of it. `blur`
  rides on `backdrop-filter`, which not every browser supports, so it can never
  be the only thing separating the layers.

#### `Affix` — @mantine/core

- **Use when:** One control must hold a viewport corner regardless of scroll — a
  back-to-top button.
- **Instead:** the shell's header or footer for anything permanent. An affix is
  an exception to the layout, not a layout.
- **Ours:** *(not wired — the shell owns every fixed edge here)*
- **Gotcha:** It renders in a portal at a fixed position, so it floats over
  content and, on a phone, over the thing being read. Keep it clear of the
  primary action and give whatever is inside a real accessible name.

#### `FloatingWindow` — @mantine/core

- **Use when:** A panel the user drags around while working elsewhere — a
  player, a debug console.
- **Instead:** `Drawer` or a route, nearly always. A window the app has to place
  is a window it also has to remember, restore, and keep on screen.
- **Ours:** *(not wired — nothing here floats)*
- **Gotcha:** Set `constrainToViewport` or it can be dragged somewhere it cannot
  be dragged back from. Position takes exactly two of the four offsets (`top`
  plus `left`, say), and the resize callbacks fire for pointer resizing only —
  keyboard resize applies immediately.

#### `Portal` — @mantine/core

- **Use when:** An element must escape a clipping or stacking ancestor — a custom
  floating layer inside an `overflow: hidden` box.
- **Instead:** nothing, for Mantine's own overlays: `Modal`, `Drawer`, `Menu`,
  `Popover` and `Tooltip` portal themselves already.
- **Ours:** *(not wired — every overlay here brings its own)*
- **Gotcha:** Its children mount only after the app is on the DOM, so a test
  asserting on the first render sees an empty container. Focus order follows the
  DOM, not the screen — portalled content that is not a dialog can strand the
  keyboard behind the thing it opened from.

### Navigation

#### `AppShell` — @mantine/core

- **Use when:** The application frame — header, navbar, main, and the breakpoint
  where the navbar becomes an overlay.
- **Instead:** nothing; there is one shell and `src/App.tsx` owns it.
- **Ours:** `src/App.tsx`, `.storybook/shell-decorators.tsx`
- **Gotcha:** The `header`/`navbar` props are geometry — the numbers there and
  the CSS the shell writes must agree, so change the width through
  `NAVBAR_WIDTH` in `src/hooks/use-shell-nav.ts` rather than in a class. Never
  nest one AppShell inside another; a story that needs the frame uses the
  decorator.

#### `NavLink` — @mantine/core

- **Use when:** A row in a navigation list — the sidebar, a settings rail.
- **Instead:** `Anchor` for a link inside prose, `Tabs` for peer views of one
  object.
- **Ours:** `src/components/nav-main.tsx`, `src/pages/Settings.tsx`
- **Gotcha:** Nested `NavLink` children collapse on their own — no separate
  disclosure component. Pass `component={Link}` plus `to`, and set `active`
  from the router rather than from local state.

#### `Burger` — @mantine/core

- **Use when:** Opening the navbar on a screen too narrow to keep it.
- **Instead:** `ActionIcon` for a rail collapse on desktop — the two toggles are
  different states, and the shell keeps them apart.
- **Ours:** `src/components/topbar.tsx`
- **Gotcha:** It needs `aria-label` and `opened`; pair it with `hiddenFrom="sm"`
  so it disappears exactly where the navbar stops being an overlay.

#### `Tabs` — @mantine/core

- **Use when:** Two to six peer views of one subject, cheap to switch, never
  needed side by side.
- **Instead:** separate routes when the view should survive a reload or be
  linkable; a sidebar rail past six sections; never tabs for settings, whose
  sections are destinations.
- **Ours:** `src/pages/Customers/CustomerDetailPage.tsx`
- **Gotcha:** Panels stay mounted by default; a heavy panel wants
  `keepMounted={false}`. Content the user must **compare** never goes in tabs.

#### `Breadcrumbs` — @mantine/core

- **Use when:** The user is deep in a hierarchy the URL already reflects — a
  record inside a project inside a workspace.
- **Instead:** a single back link when there is exactly one level above.
  Breadcrumbs on a two-level app are furniture.
- **Ours:** *(not wired — the detail routes here are one level below their list)*
- **Gotcha:** It only inserts separators; the items are yours, so they carry
  `component={Link}` and the last one is plain text rather than a link to the
  page you are already on. The `<nav aria-label="Breadcrumb">` around it is
  yours too.

#### `Pagination` — @mantine/core

- **Use when:** A long list is served in pages and the page belongs in the URL.
- **Instead:** the table's own pager where one already exists; infinite scroll
  only when the list has no end and nobody needs to come back to a position.
- **Ours:** `src/components/data-table.tsx` (opt-in through `pageSize`),
  `src/pages/Customers/CustomersPage.tsx`
- **Gotcha:** `value` is 1-based, so the 0-based page index TanStack keeps has
  to be shifted on the way in and out. Filtering is the other half: it shrinks
  the row set under a page index that was valid a keystroke ago, and nothing
  moves it for you — the table resets to page 1 when the filtered count drops
  below the current page, or the reader lands on page 4 of 2. The controls are
  buttons unless you make them links through the compound parts, and only links
  survive a middle-click or a copied URL.

#### `Stepper` — @mantine/core

- **Use when:** A sequence with real prerequisites — onboarding, a checkout, a
  wizard whose steps cannot be done out of order.
- **Instead:** `Tabs` when the sections are peers; separate routes when a step
  must survive a reload or be linkable.
- **Ours:** *(not wired — no flow here has more than one step)*
- **Gotcha:** `Stepper.Step` must be a direct child — wrapping one in your own
  component breaks the ordering the component relies on. Icon-only steps need
  `aria-label` or `title`, and `allowNextStepsSelect={false}` is what stops
  someone jumping to a step the data cannot support yet.

#### `Menubar` — @mantine/core

- **Use when:** A desktop-application command bar — File, Edit, View — where the
  arrow keys walk the whole bar.
- **Instead:** `Menu` for a single trigger, a row of buttons for fewer than three
  menus. In a browser app this is nearly always the wrong idiom.
- **Ours:** *(not wired — the chrome here is a sidebar and a topbar)*
- **Gotcha:** Only one menu is open at a time and moving sideways opens the
  sibling immediately — that behaviour is what makes it a menubar rather than a
  row of menus. Checkbox and radio items do not close it. The root already
  carries `role="menubar"`; do not wrap it in another one.

#### `TableOfContents` — @mantine/core

- **Use when:** A long document page needs a live outline — docs, a changelog,
  terms of service.
- **Instead:** `NavLink` rows for application navigation. This one tracks
  headings in the viewport, not routes.
- **Ours:** *(not wired — no page here is long-form)*
- **Gotcha:** It reads the headings once, so content that arrives later needs
  `reinitialize`. The link and its label come out of `getControlProps` — an empty
  outline almost always means the selector matched nothing.

### Data display

#### `Table` — @mantine/core

- **Use when:** Records with shared attributes, read-only, small enough to show.
- **Instead:** the repo's `DataTable` the instant sorting, filtering, pagination
  or selection appears — do not grow a `Table` into one by hand. A card grid
  when the record is visual.
- **Ours:** `src/components/data-table.tsx`, `src/pages/BillingPage.tsx`
- **Gotcha:** The compound parts are required (`Table.Thead`, `Table.Tbody`,
  `Table.Tr`, `Table.Th`, `Table.Td`) — a raw `<tr>` inside is both a lint
  failure and an unstyled row. `stickyHeader` needs a scroll container with a
  bounded height.

#### `DataList` — @mantine/core

- **Use when:** Label/value pairs about one record — the metadata block on a
  detail page. It is a real `<dl>`, so the pairing is in the markup rather than
  only in the layout.
- **Instead:** `Table` when the rows are many records rather than one record's
  attributes. `SimpleGrid` when the pairs are not label/value at all.
- **Ours:** `src/pages/Customers/CustomerDetailPage.tsx`
- **Gotcha:** The compound parts are required — `DataList.Item` wrapping a
  `DataList.ItemLabel` and a `DataList.ItemValue`. The customer record used to
  be a 1px-gap `SimpleGrid` over a `Box component="dl"` with a local `Meta`
  helper: a definition list reimplemented, dividers and label column included.
  `withDivider` is the rule between rows and `labelWidth` is the column.

#### `EmptyState` — @mantine/core

- **Use when:** A list, pane or failed fetch has nothing to show. Every one of
  the four states a surface can be in gets a designed answer, and this is the
  answer to two of them.
- **Instead:** nothing hand-rolled. This app carried its own `EmptyState`
  composite — a `Stack`, a `ThemeIcon` disc and two type sizes — written when
  Mantine had no such component. Mantine 9 ships it with the same shape
  (`icon`, `title`, `description`, `EmptyState.Actions`), so the composite was
  deleted rather than maintained beside it.
- **Ours:** `src/pages/Customers/CustomersPage.tsx`, `src/pages/InboxPage.tsx`
- **Gotcha:** `icon` takes an **element**, not a component reference —
  `icon={<Building2 size={20} />}`, not `icon={Building2}`. The
  actions slot is `EmptyState.Actions`; children dropped in loose are laid out
  by the body instead.

#### `RollingNumber` — @mantine/core

- **Use when:** One figure per screen deserves emphasis — the number the reader
  opened the page for. It animates from its previous value to the new one, digit
  by digit.
- **Instead:** plain `Text` for every other number on the page. A count-up on
  all of them says nothing and costs the reader half a second before any of them
  can be read. `NumberFormatter` when the figure should be formatted but not
  animated.
- **Ours:** `src/pages/Dashboard.tsx`
- **Gotcha:** It does **not** carry Mantine's `data-reduce-motion`, so
  `respectReducedMotion` on the provider does not reach it — pass
  `animationDuration={0}` yourself when `useMotionEnabled()` is false, or probe
  rule M1 fails the page. Give it `decimalScale` and `tabularNumbers`: the
  hand-rolled version this replaced shipped `17.53475804302434` mid-count and a
  box that resized every frame, and both are props here.

#### `Card` · `Paper` — @mantine/core

- **Use when:** Grouping content on the page. `Paper` is the plain surface;
  `Card` adds sections.
- **Instead:** nothing hand-rolled: a `div` with a border and a background is
  the single most common ui-lint failure. `Panel` (ours) when the surface is a
  page region with a header.
- **Ours:** `src/components/panel.tsx`, `src/components/stat-card.tsx`
- **Gotcha:** `Card.Section` is what reaches the card's edges — padding a child
  by hand to fake it fights the radius. A card inside a card is almost always a
  section with a heading.

#### `Avatar` — @mantine/core

- **Use when:** Representing a person or a workspace.
- **Instead:** `ThemeIcon` when the graphic is a category rather than an
  identity.
- **Ours:** `src/components/nav-user.tsx`, `src/pages/Settings.tsx`
- **Gotcha:** `name` plus `color="initials"` derives the fallback — do not slice
  the string yourself. A decorative avatar next to the same name in text is
  `alt=""`, not a repeat.

#### `ThemeIcon` — @mantine/core

- **Use when:** An icon that needs a tinted surface — an empty state's glyph, a
  list row's category mark.
- **Instead:** `ActionIcon` the moment it is clickable.
- **Ours:** `src/components/app-sidebar.tsx`, `src/pages/InboxPage.tsx`
- **Gotcha:** It is decorative by default; if it carries meaning, the meaning
  belongs in adjacent text.

#### `ScrollArea` — @mantine/core

- **Use when:** A region scrolls independently of the page — a table body, a
  sidebar, a dropdown list.
- **Instead:** letting the page scroll, which is right far more often than a
  nested scroller.
- **Ours:** `src/components/data-table.tsx`, `src/components/app-sidebar.tsx`
- **Gotcha:** It only scrolls inside a bounded box — `min-h-0 flex-1` on the
  parent, or it grows forever and nothing moves. Tag the viewport with
  `data-slot="scroll-area-viewport"`; the probe reads that to tell a real
  scroller from an overflowing div, and a page header must never sit inside one.

#### `Divider` — @mantine/core

- **Use when:** Separating two groups that a gap alone leaves ambiguous.
- **Instead:** spacing first. A bordered surface whose first child is a divider
  has drawn the same line twice.
- **Ours:** `src/components/topbar.tsx`
- **Gotcha:** `orientation="vertical"` needs a height from its parent.

#### `AreaChart` · `Sparkline` — @mantine/charts

- **Use when:** The trend or the comparison is the point.
- **Instead:** a table when the user came for exact values; a chart plus a table
  is often the honest answer.
- **Ours:** `src/pages/Dashboard.tsx`, `src/components/stat-card.tsx`
- **Gotcha:** Recharts underneath, so the container needs an explicit height
  (`h={220}`), and series colours are **theme colour names** (`'blue.6'`), not
  hex. Import the package's CSS or the axes render bare.

#### `Carousel` — @mantine/carousel

- **Use when:** Peer items that genuinely do not fit, and missing one costs
  nothing — screenshots, testimonials.
- **Instead:** a grid, nearly always: nothing hidden, everything scannable.
- **Ours:** `src/components/_overview/Widgets.stories.tsx`
- **Gotcha:** Embla underneath, and its options go through `emblaOptions` (the
  v7 top-level props are gone). Controls need labels, and autoplay must stop on
  hover, focus and `prefers-reduced-motion`.

#### `Accordion` — @mantine/core

- **Use when:** Sections a reader opens one at a time — an FAQ, a settings group,
  the optional half of a long form.
- **Instead:** `Tabs` when the sections are peers and switching is instant; a
  route when a section is really a page. Never hide something the user needs in
  order to finish.
- **Ours:** `src/pages/BillingPage.tsx` (the billing questions)
- **Gotcha:** Set `order` (`h2`–`h6`): the control renders as a heading and the
  library will not pick the level for you, so the page outline is your
  responsibility. `multiple` allows more than one open panel;
  `chevronPosition` and `disableChevronRotation` are appearance, not state.

#### `Collapse` — @mantine/core

- **Use when:** One region opens and closes and you own the trigger — a "show
  details" row inside a card.
- **Instead:** `Accordion` for a set of them; `Spoiler` when the point is
  truncating overflow rather than disclosing a section.
- **Ours:** *(not wired — the sidebar's nested `NavLink`s collapse themselves)*
- **Gotcha:** It animates height, so a child with its own height transition
  fights it. The trigger is yours, which means `aria-expanded` and
  `aria-controls` are yours — the component adds neither.

#### `Spoiler` — @mantine/core

- **Use when:** Long copy should show its first few lines with a way to read the
  rest — a description, a log entry, a support message.
- **Instead:** `Collapse` when the content starts closed; a `lineClamp` on `Text`
  when there is nothing to expand into.
- **Ours:** *(not wired — no copy here overflows by design)*
- **Gotcha:** `hideLabel` and `showLabel` are required — they are the toggle's
  accessible name in each state. Content shorter than `maxHeight` renders with no
  control at all, which is correct behaviour and also why a two-line story of it
  looks broken.

#### `Timeline` — @mantine/core

- **Use when:** Events in order, where the sequence is the story — an audit
  trail, a delivery status, an activity feed.
- **Instead:** `Table` when the reader compares rows rather than follows them;
  `List` when the order is not chronological.
- **Ours:** *(not wired — the activity here is a table)*
- **Gotcha:** `Timeline.Item` must be a direct child; the connecting line is
  drawn from their order. `active` is an index and everything before it is
  painted as done, so an off-by-one here is a claim about what has happened.

#### `Tree` — @mantine/core

- **Use when:** The data is a hierarchy the user expands in place — files,
  nested categories, an org chart.
- **Instead:** `NavLink` with nested children for navigation; `Table` when the
  nesting is one level deep and the columns are the point.
- **Ours:** *(not wired — nothing here is hierarchical)*
- **Gotcha:** `data` must be a **memoized** array of nodes with unique `value`s —
  a fresh array on every render collapses the tree on every keystroke.
  `useTree()` owns expanded and checked state, and `checkStrictly` decides
  whether a parent's checkbox reaches its children.

#### `Image` · `BackgroundImage` — @mantine/core

- **Use when:** Content imagery — a product shot, a card header, an uploaded
  file's preview.
- **Instead:** `Avatar` for a person or a workspace, `ThemeIcon` for a glyph, CSS
  for decoration that carries no meaning.
- **Ours:** *(not wired — the only images here are avatars)*
- **Gotcha:** `Image` is a thin `img` wrapper that fills its parent's width, so
  it needs `h` plus `fit` or a tall photo sets the row height. Content images
  need `alt`; decorative ones need `alt=""` rather than no attribute at all.
  `BackgroundImage` puts children on top of an image, so the contrast underneath
  them is yours to prove.

#### `AspectRatio` — @mantine/core

- **Use when:** Media must hold its ratio while the column resizes — a video
  embed, a map, a 16:9 thumbnail.
- **Instead:** a fixed `h` when the height really is fixed. A ratio box around
  text is how a card starts clipping sentences.
- **Ours:** *(not wired — no media surface here yet)*
- **Gotcha:** It takes the width it is given, so inside a flex row it needs a `w`
  or a `flex` — otherwise it collapses and the media disappears completely.

#### `NumberFormatter` — @mantine/core

- **Use when:** A figure needs separators, a prefix or a suffix and nothing
  else — a price in a cell, a count in a tile.
- **Instead:** `RollingNumber` for the one figure a page animates;
  `Intl.NumberFormat` when the string is going somewhere other than the screen.
- **Ours:** *(not wired — `src/lib/format.ts` formats the figures here)*
- **Gotcha:** It renders text, not a box, so it belongs inside the `Text` that
  owns the size and weight. `thousandSeparator` and `decimalScale` are what
  decide whether a column of numbers lines up under itself.

#### `OverflowList` — @mantine/core

- **Use when:** A row of items must degrade rather than overflow — filter chips,
  a trail of avatars that becomes "+3".
- **Instead:** `Scroller` when the user should be able to reach every item;
  wrapping when growing taller is acceptable.
- **Ours:** *(not wired — no row here overflows yet)*
- **Gotcha:** It measures before it can know what fits, so it renders once and
  then settles. Whatever it collapses must stay reachable from the keyboard, and
  anything essential must exist somewhere that is not behind the "+3".

#### `Marquee` — @mantine/core

- **Use when:** A decorative ribbon — logos, quotes — where nothing inside is
  needed to finish a task.
- **Instead:** a static grid, nearly always. Moving text is slow to read and, for
  some readers, unreadable.
- **Ours:** *(not wired — nothing here scrolls itself)*
- **Gotcha:** It animates forever. Set `pauseOnHover`, and gate it on
  `useMotionEnabled()` from `src/lib/motion.ts` — this app's reduced-motion
  contract (probe rule `M1`) covers it and Mantine will not stop it for you.

### Layout

#### `Group` · `Stack` — @mantine/core

- **Use when:** A row or a column of siblings with consistent spacing.
- **Instead:** `Flex` when the direction itself is responsive, `SimpleGrid` when
  the children are cells rather than siblings. Never a `div` with a flex class —
  there is no CSS to back it.
- **Ours:** `src/components/topbar.tsx`, `src/pages/TeamPage.tsx`
- **Gotcha:** `Group` does not wrap by default in the way a flex row does —
  `wrap="wrap"` is a prop. Neither shrinks its children; a long label needs
  `truncate` on the child, not on the group.

#### `SimpleGrid` — @mantine/core

- **Use when:** Equal-width cells that reflow by breakpoint — a stat row, a card
  grid.
- **Instead:** `Grid` when columns have different spans; `Box display="grid"`
  with an explicit `gridTemplateColumns` when the track sizing is bespoke — an
  `auto-fit` / `minmax` layout is the one `SimpleGrid` cannot state.
- **Ours:** `src/pages/Settings.tsx`, `src/pages/BillingPage.tsx`
- **Gotcha:** `cols={{ base: 1, sm: 2, lg: 4 }}` — a bare number is a fixed
  column count at every width, which is how a dashboard ends up with four
  columns on a phone.

#### `Center` · `Box` — @mantine/core

- **Use when:** `Center` centres one child in the space it has; `Box` is the
  polymorphic element that takes Mantine style props and `component`.
- **Instead:** a plain `div` only when it carries nothing at all — no class, no
  style, just grouping two nodes. The moment it needs spacing, a size or a
  colour it is a `Box`.
- **Ours:** `src/components/data-table.tsx`, `src/pages/InboxPage.tsx`
- **Gotcha:** `Box` takes the whole style-prop set (`p`, `w`, `pos`, `bg`), and
  what is left over goes in `style` — `minHeight: 0`, `overflow`, a
  `gridTemplateColumns`. Reach for `style`, not a class.

### Utilities and accessibility

#### `FocusTrap` — @mantine/core

- **Use when:** A surface this app built itself has to hold focus — a custom
  overlay that is not a `Modal` or a `Drawer`.
- **Instead:** `Modal`, `Drawer`, and `Popover trapFocus`, which trap already. A
  second trap around one of them fights the first.
- **Ours:** *(not wired — every trapping surface here is a Mantine one)*
- **Gotcha:** The child must accept a ref and contain something focusable, or the
  trap silently does nothing at all. `data-autofocus` names the element focused
  first; `FocusTrap.InitialFocus` is the escape hatch for when nothing inside
  should take focus.

#### `VisuallyHidden` — @mantine/core

- **Use when:** A screen reader needs words the design does not show — what an
  icon-only column means, the preamble to a live region.
- **Instead:** `aria-label` on the control itself when the words *are* its name.
  Hidden text is for context, not for naming.
- **Ours:** *(not wired — the icon-only controls here carry `aria-label`)*
- **Gotcha:** `display: none` and the `hidden` attribute remove content from the
  accessibility tree; this keeps it in. Everything inside is announced, so it is
  not a place to park text nobody should hear.

#### `Transition` — @mantine/core

- **Use when:** One element's presence should animate and it is not already
  inside a Mantine overlay that animates itself.
- **Instead:** this app's motion layer — `src/lib/motion.ts` and
  `src/components/reveal.tsx` — for anything on a page, so durations and easings
  stay tokens rather than numbers typed at a call site.
- **Ours:** *(not wired — page motion goes through the motion layer)*
- **Gotcha:** `mounted` drives it and the child unmounts on exit unless
  `keepMounted`. Respecting reduced motion is a provider setting, not a default
  of the component — and probe rule `M1` fails a page that animates anyway.

#### `FloatingIndicator` — @mantine/core

- **Use when:** Building a custom control that needs the sliding highlight `Tabs`
  and `SegmentedControl` have.
- **Instead:** those two components. The indicator is the hard part of them, not
  a replacement for them.
- **Ours:** *(not wired — the segmented controls here are Mantine's)*
- **Gotcha:** The `parent` element must have `position: relative` or the
  indicator lands somewhere else entirely, and it ships with no visible styles at
  all — those are yours. Its `transform`, `width` and `height` cannot be
  overridden through the Styles API.

#### `Grid` — @mantine/core

- **Use when:** Columns have different widths or offsets and must reflow by
  breakpoint — a two-thirds form beside a one-third summary.
- **Instead:** `SimpleGrid` when every cell is equal; `Box display="grid"` when
  the tracks are bespoke and live on one page.
- **Ours:** *(not wired — the grids here are equal-width `SimpleGrid`s)*
- **Gotcha:** `Grid.Col`'s `span` is out of 12 unless you change `columns`, and
  responsive spans are objects — `span={{ base: 12, md: 6 }}`. A bare `span={6}`
  is half the width on a phone too, which is how a form ends up in two columns on
  a 375px screen.

#### `Flex` — @mantine/core

- **Use when:** A flex container needs a responsive direction or wrapping that
  `Group` and `Stack` cannot express.
- **Instead:** `Group` for a row and `Stack` for a column — shorter, and
  consistent with everything else here.
- **Ours:** `src/pages/Auth/AuthLayout.tsx`, `src/pages/NotFoundPage.tsx`
- **Gotcha:** Its props take responsive objects, which is the only reason to
  reach for it. `gap` is Mantine's scale — pass the name (`gap="md"`), not a
  pixel value, or the theme stops reaching it.

#### `Container` — @mantine/core

- **Use when:** Prose or a form needs a measured line length inside a wide page —
  a settings pane, a marketing section.
- **Instead:** the shell's own padding for application pages. A container inside
  a container is where the gutters double.
- **Ours:** *(not wired — `src/components/page-shell.tsx` owns the page width)*
- **Gotcha:** `size` is a fixed `max-width`, not a responsive one, and `fluid`
  drops it entirely. `strategy="grid"` changes the model — no inline padding, and
  columns instead of a `max-width` — so do not mix the two strategies in one
  page.

#### `Space` — @mantine/core

- **Use when:** Separating raw HTML that has no margin props of its own.
- **Instead:** `mt` / `mb` on the component, or the parent's `gap`. Spacing
  belongs to the container, not to an empty element wedged between siblings.
- **Ours:** *(not wired — spacing here is `Stack` and `Group` gaps)*
- **Gotcha:** It is a `div` with a height. In a flex or grid parent it becomes a
  child the layout has to place, which is how an extra gap appears where nobody
  wrote one.

#### `Splitter` — @mantine/core

- **Use when:** Two panes the user resizes against each other and both stay in
  view — an editor beside its preview.
- **Instead:** two routes for a collection and one of its records. A record in a
  sidecar pane cannot be linked, refreshed or opened in a tab, which is why the
  `list` and `detail` archetypes here are separate routes.
- **Ours:** *(not wired — and the master-detail case deliberately is not this)*
- **Gotcha:** `Splitter.Pane` must be a direct child — wrapping one is
  unsupported and silently misplaces the handles. Panes keep their size when the
  container resizes, so a layout that has to reflow on a phone should not be a
  splitter at all.

#### `Scroller` — @mantine/core

- **Use when:** A horizontal row genuinely exceeds its width and every item
  matters — a wide tab strip, a rail of cards.
- **Instead:** `ScrollArea` for a vertical region, `OverflowList` when the tail
  may collapse, wrapping when the row is allowed to grow taller.
- **Ours:** *(not wired — nothing here scrolls sideways)*
- **Gotcha:** The chevron controls appear only while the content overflows, so a
  story with three items shows none. Keep it inside a bounded box: horizontal
  scrolling on the page itself is a probe failure, not a layout.

### Theme and system

#### `MantineProvider` · `createTheme` · `useMantineColorScheme` · `localStorageColorSchemeManager` — @mantine/core

- **Use when:** Changing a default for the whole app, or reading/flipping the
  colour scheme.
- **Instead:** a per-call-site prop repeated three times — that is a theme
  change wearing a disguise.
- **Ours:** `src/theme.ts`, `src/components/theme-provider.tsx`,
  `src/components/theme-toggle.tsx`
- **Gotcha:** One provider, at the root, above the router. Defaults belong in
  `components.X.defaultProps` in `src/theme.ts`; colours belong in
  `theme.colors` as ten-shade tuples. The colour scheme is persisted by the
  manager — do not also write the class yourself.

#### `defaultVariantColorsResolver` — @mantine/core

- **Use when:** A rule about a variant's colours holds for every component that
  has variants — the ink on a filled surface, say — and differs by colour
  scheme. Wrap it as `theme.variantColorResolver` and change only what differs.
- **Instead:** a `classNames` override per component, which misses the ones
  nobody listed, or a `--*-color` override in a stylesheet, which loses to the
  variable Mantine writes inline.
- **Ours:** `src/theme.ts` — `variantColorResolver` sends a filled surface's ink
  to `--app-on-fill`, the dark ink in dark and white in light.
- **Gotcha:** `autoContrast` resolves a filled colour's text once, against the
  *light* scheme's `primaryShade`, and keeps it in dark. With a palette whose
  dark fill is light and whose light fill is dark, that is white text on the
  lime. Return a scheme-dependent CSS variable rather than a colour.

#### `useHotkeys` — @mantine/hooks

- **Use when:** Never, here. Global shortcuts go through
  `useHotkey`/`useHotkeys` from `@tanstack/react-hotkeys` instead, and this app
  has no second keyboard system by design.
- **Instead:** a local `onKeyDown` when the key only means something while one
  control has focus — that stays a DOM handler and does not belong in a global
  registry either.
- **Ours:** `src/App.tsx` (⌘B, the rail) and `src/components/command-palette.tsx`
  (⌘K), both on `@tanstack/react-hotkeys`.
- **Gotcha:** `Mod` is the portable modifier — Command on a Mac, Control
  everywhere else — so never write `Meta+K` and never read `event.metaKey`
  yourself. `ignoreInputs` is the typing guard and it defaults by chord: on for
  a bare key, off for Escape and for Ctrl/Command combinations. `preventDefault`
  and `stopPropagation` both default to **true**, which is wrong for any chord
  another handler also needs to see, Escape above all. Every shortcut still
  needs a visible affordance — a `Kbd` in the tooltip or the menu item, written
  with `formatForDisplay` so it reads correctly on both platforms.

## Deliberately not routed

Every component `@mantine/core` ships has to be answered somewhere: an entry
above, or a line here saying why not. `M10` fails the build on a component that
is neither, which is what turns a Mantine upgrade into a decision rather than a
silent gap.

- `ModalBase` — the internal base `Modal` and `Drawer` are assembled from. It
  has no documentation page of its own and no product decision to make: build on
  `Modal`, on `Drawer`, or on `Popover` with `trapFocus`.

## What Mantine does not give you

Four things this app needs are **not** Mantine components, and reaching for a
Mantine one instead is the mistake this section exists to prevent:

- **Forms.** `@mantine/form` is deliberately not installed. Validation is
  react-hook-form + zod, and Mantine inputs are the fields it drives. See the
  `add-form` skill.
- **Tables with behaviour.** TanStack Table is headless and owns sorting,
  filtering and selection; `Table` only paints it. `src/components/data-table.tsx`
  is the join, and the `add-table` skill extends it.
- **Routing.** TanStack Router owns every URL. Any Mantine component that
  navigates takes `component={Link}`.

## How to add a component that isn't here

1. Check `docs/principles/component-selection.md` first — the answer is often a
   component this map already lists, used differently.
2. Import it directly from `@mantine/core` (or the sibling package). Do not wrap
   it in `src/components/` "for consistency": a wrapper with no product decision
   in it is the kit this repo just deleted.
3. If it needs a default everywhere, set it in `src/theme.ts`; if it needs one
   here only, pass the prop.
4. Every component in the library already has an entry, so the usual edit is
   changing one — swap `*(not wired…)*` for the slice you just wrote. A genuinely
   new one (a Mantine upgrade added it) needs a full entry — component, package,
   `Use when:`, `Instead:`, `Ours:`, `Gotcha:` — or a line in **Deliberately not
   routed** saying why not. `npm run capability-lint` fails on either gap, which
   is how this file stays a map instead of a snapshot.
5. Run `make check`. `ui-lint` will tell you if the new call site painted
   something Mantine already owns.

## Sources

Read from Mantine's own documentation on **2026-09-04**, against
**@mantine/core 9.6.0**. Re-read before trusting a prop name; Mantine renames
props across majors and this file is the only place the renames are written
down.

- <https://mantine.dev/getting-started/>
- <https://mantine.dev/theming/theme-object/>
- <https://mantine.dev/theming/default-props/>
- <https://mantine.dev/styles/styles-api/>
- <https://mantine.dev/core/app-shell/>
- <https://mantine.dev/core/button/>
- <https://mantine.dev/core/text-input/>
- <https://mantine.dev/core/select/>
- <https://mantine.dev/core/modal/>
- <https://mantine.dev/core/menu/>
- <https://mantine.dev/core/table/>
- <https://mantine.dev/core/scroll-area/>
- <https://mantine.dev/core/tooltip/>
- <https://mantine.dev/dates/date-picker-input/>
- <https://mantine.dev/charts/area-chart/>
- <https://mantine.dev/x/spotlight/>
- <https://mantine.dev/x/notifications/>
- <https://mantine.dev/x/modals/>
- <https://mantine.dev/x/carousel/>
- <https://mantine.dev/hooks/use-hotkeys/>

The rows added when this map was widened to the whole `@mantine/core` surface
were read from Mantine's own LLM-formatted documentation — the index of every
component page and the consolidated dump of them — plus the pages whose entries
make the strongest claims:

- <https://mantine.dev/core/package/>
- <https://mantine.dev/llms.txt>
- <https://mantine.dev/llms-full.txt>
- <https://mantine.dev/core/dialog/>
- <https://mantine.dev/core/combobox/>
- <https://mantine.dev/core/autocomplete/>
- <https://mantine.dev/core/multi-select/>
- <https://mantine.dev/core/tags-input/>
- <https://mantine.dev/core/input/>
- <https://mantine.dev/core/grid/>
- <https://mantine.dev/core/container/>
- <https://mantine.dev/core/splitter/>
- <https://mantine.dev/core/slider/>
- <https://mantine.dev/core/tree/>
- <https://mantine.dev/core/accordion/>
- <https://mantine.dev/core/stepper/>
- <https://mantine.dev/core/transition/>
- <https://mantine.dev/core/focus-trap/>
- <https://mantine.dev/core/marquee/>
