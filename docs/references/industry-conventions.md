# Industry Conventions

A screen rendered in the wrong visual language reads as wrong before the user
can say why. A payments dashboard that looks like a fitness app is not fresh;
it is untrustworthy, and trust is the entire product in that category.

This is a reference, not a principle: it does not tell you what is good, it
tells you what the user has already been trained to expect. Read it at Step 0
of [../principles/screen-archetypes.md](../principles/screen-archetypes.md),
alongside the archetype choice, and record the answer in `BLUEPRINT.md` or in
the feature plan.

## Before the vertical: which user stage?

The same screen serves three people, and density, copy and motion all change
between them:

- **New.** Has not yet seen the value. Wants orientation, one obvious next
  action, and fewer options than you think. Empty states are the product here.
- **Returning.** Knows the shape, comes for one thing. Wants their last state
  preserved — filters, selection, scroll — and the one thing reachable in a
  click.
- **Power.** Lives here. Wants density, keyboard access, bulk actions, and no
  animation between them. Every ms of transition is a tax paid many times a
  day.

A dashboard designed only for the new user bores the power user by week two; a
dashboard designed only for the power user loses the new one on day one. Say
which you are designing for, and what the other two get.

## Developer tools / infrastructure

- **Dark-first is the convention**, not a preference. This app already is.
- Monospace for anything a machine produced: IDs, hashes, durations, log lines,
  regions. Proportional type for prose. Mixing them randomly is the tell of a
  tool built by people who do not use it.
- Status is a colour *and* a word. A green dot alone fails for the ~8% of men
  with a colour vision deficiency and in every screenshot pasted into a ticket.
- Density is a feature. Padding that flatters a marketing page hides half the
  rows an on-call engineer needs.
- **The trap:** decorating the failure state. When something is down, the user
  wants the error string, the timestamp and the retry — not an illustration.

## Fintech / payments / billing

- **Trust is the design goal**, and it is built from restraint: conventional
  layout, no gradients on anything numeric, no motion on money.
- Currency is right-aligned, tabular-numeric, with the symbol and the code where
  ambiguity is possible (`$1,200 USD`). Never abbreviate a charge to `1.2k`.
- Every number states its period and its basis. "£2,400" is trivia; "£2,400
  this month, vs £1,900 last" is information.
- Destructive and irreversible actions name the object and the amount in the
  confirm, and the amount is not the only thing in bold.
- **The trap:** celebrating a charge. The peak of a billing flow is the user's
  *confidence that the right thing happened*, not confetti.

## Analytics / BI

- The chart is never the only statement of its data. The headline figure, the
  comparison and one sentence of interpretation carry it in text — a chart is
  silent to a screen reader and useless in a pasted screenshot.
- One question per view. A screen that answers three is a screen nobody reads
  twice.
- Comparison is mandatory: a number with nothing to compare against cannot be
  acted on. Put the delta beside the figure, not below it.
- **The trap:** the six-tile grid of equal weight. See the `dashboard-grid`
  archetype — the KPI row is 2–4 tiles precisely because five is a table.

## CRM / sales

- The record is the unit, and the record's *owner* and *stage* are the two
  things always visible.
- Recency beats alphabetical everywhere. Sales users navigate by "what did I
  touch last", not by name.
- Bulk actions are not an advanced feature; they are the primary interaction.
  A list without multi-select will be replaced by a spreadsheet.
- **The trap:** burying the note field. The free-text note is where the real
  work goes, and it is usually the smallest control on the screen.

## Project management / issue tracking

- Keyboard first. `⌘K`, `j`/`k`, and a shortcut for the primary action. This app
  ships a command palette — use it as the spine, not the garnish.
- State changes are optimistic and reversible via undo, never via a confirm
  dialog. A confirm on every status change makes the tool slower than the
  spreadsheet it replaced.
- Assignment and due date are the two fields that must never be more than one
  interaction away.
- **The trap:** a modal for editing. The record deserves a route; a modal loses
  the URL, and the URL is how teams talk to each other.

## Healthcare / clinical

- Accuracy over density, and never an abbreviation the user has not been
  trained on.
- Units are always shown, always. A number without units in a clinical context
  is a defect, not a style choice.
- No optimistic updates on anything that writes to a record. The user needs to
  know it is *saved*, not that it will probably save.
- **The trap:** the friendly tone. Warmth in microcopy reads as flippant when
  the subject is a person's health. Plain, precise, calm.

## E-commerce / marketplace admin

- Imagery is content: product thumbnails belong in the row, and their aspect
  ratio is fixed so the list does not jitter.
- Money, inventory and status form one visual group; anything else in the row
  is secondary.
- Fulfilment state has a canonical order, and the UI shows position in that
  order, not just the current label.
- **The trap:** treating orders as a generic table. The order list is the
  operator's whole day; it earns a bespoke row, not `DataTable` defaults.

## Security / compliance

- Auditability is visible: who, when, from where, on every state change.
- Severity has a fixed scale with fixed colours, used nowhere else in the app.
- Never soften a failure. "3 controls failed" is the headline; the remediation
  is underneath it.
- **The trap:** the green dashboard. A compliance screen whose default state is
  all-green trains the user to stop reading it.

## AI products

- Show the source. An answer with no citation is a claim, and users have
  learned to distrust claims.
- Streaming output needs a visible stop control and a stable layout — text that
  reflows as it arrives is unreadable while it arrives.
- Confidence is communicated in words, never in a percentage the model did not
  actually compute.
- **The trap:** hiding the input. The prompt is the primary control; a chat box
  pushed to the bottom of a busy screen makes the product feel like a feature.

## How to use this file

1. At Step 0, name the vertical and the user stage.
2. Take the conventions that apply and write them into the feature plan's
   surface notes — they constrain the archetype, they do not replace it.
3. Where a convention conflicts with a principle in `docs/principles/`, the
   principle wins and the conflict goes in `DECISIONS.md`. A convention is what
   users expect; a principle is what this app has decided to be.
4. If the product's vertical is not listed, say so in the plan and name the two
   nearest entries. Guessing silently is what this file exists to prevent.
