<!-- principle:emotional-design:v2 -->
<!-- Stamped from the shared principles source by stamp-principles.mjs. Edit the source and re-stamp: a hand edit fails principles-drift. -->

# Emotional Design

A screen passes every gate and is still forgettable. `ui-lint` is green, the
axe suite is clean, the archetype holds at three widths, and the user finishes
the task and remembers nothing about it.

That is what this principle is for. The other documents in this folder own the
pixels. This one owns **the moment the user takes away**.

## The failure this prevents

**Polish spread evenly.** Given a screen and time, the instinct is to improve
everything a little: a nicer shadow here, a smoother transition there, a
slightly better empty state. The result reads as competent and lands as
nothing, because attention paid uniformly is attention nobody notices.

The second failure is quieter and worse: **the app has no end**. The user
finishes what they came for, and the screen just… stays. Nothing marks the
completion, nothing says what happens next, and the last impression is a
form that has gone quiet.

## Peak-End Rule

From Kahneman: people do not remember an experience as an average. They
compress it into two moments — the **peak** (the most intense point) and the
**end** (the last impression before leaving) — and judge the whole by those.

The corollary is uncomfortable. **A uniformly good screen is remembered less
than a mostly quiet screen with one excellent moment and one excellent
ending.** Spreading polish dilutes it; concentrating it multiplies it.

This is why every surface in a feature plan should name its peak and its end
before it is drawn — not because a string in a plan makes a screen
memorable, but because a surface whose author cannot name either moment is a
surface with neither.

### Naming the peak

The peak is the instant the user gets what they came for. Not the page load,
not the animation on the hero — the moment the thing happens:

- the invoice sends and the status flips to Paid
- the deploy goes green
- the search returns the row they were looking for
- the import finishes and the count is right

Pick **one**. A second peak is a tie, and ties are forgettable. That one moment
earns:

- **motion that resolves**, not motion that loops. See
  [motion.md](motion.md). A spring that settles reads as *done*; a spinner that
  keeps going reads as *waiting*.
- **the accent at full strength.** The primary tone at 100%, not a 5% tint. The rest
  of the screen is where restraint lives; this is not.
- **stillness after.** The eye needs the motion to finish. A success state that
  immediately starts a second animation has stepped on its own moment.
- **the number in the user's units.** "Paid £2,400 · 12 days early", not
  "Status updated".

Everything else on the screen stays quiet. Motion on a row that does nothing
reads as lag, and a page where six things animate has no peak at all.

### Naming the end

The end is the last thing on screen before the user leaves — the confirmation,
the summary, the state the page settles into. It earns:

- **a summary, not a dump.** "3 invoices sent · £7,200" beats a table of
  everything that just happened.
- **the next thing, named.** Not a generic CTA. "Nothing else due this week"
  is an ending; "Browse invoices" is a corridor.
- **stillness.** No shimmer, no cascade, no skeleton still settling. The end is
  where the eye rests, and resting means nothing is moving.
- **no cleverness.** The end is the place to be unforgettable for being
  simple.

An archetype whose end is genuinely "the user keeps working" — a
`dashboard-grid` they leave open all day — still has one: the state the screen
holds when they stop looking at it. Say that, and design it.

## The three that matter more than polish

Borrowed from teams that ship consumer-grade software at scale, and true of
B2B tools too:

1. **Familiar, then different.** A user who cannot find the primary action in
   two seconds does not stay long enough to be delighted. Convention first,
   distinctiveness second — and only where it costs the user nothing.
2. **Emotion is in the copy before it is in the pixels.** "We couldn't reach
   the server — retry?" and "Error 500" are the same state and different
   products. See [microcopy.md](microcopy.md).
3. **Speed is a feeling.** A perceived-instant response beats a beautiful
   loading state. Optimistic updates, skeletons that match the real layout, and
   never a spinner where a skeleton would do.

## What this principle is not

- **Not decoration.** A confetti burst on a screen whose task failed is worse
  than nothing. The peak has to be the moment that actually mattered.
- **Not a licence to animate.** Every rule here is subject to
  `prefers-reduced-motion`; see [motion.md](motion.md). A peak that only exists
  as movement does not exist for everyone.
- **Not a substitute for the other gates.** A memorable screen that fails the
  a11y suite is a screen that excluded people memorably.
- **Not per-component.** Peak and end are properties of a *surface*, which is
  why they live in the feature plan and not in a story.

## On this platform — React + Mantine

## Where the moments live in each archetype

| Archetype | Peak is usually | End is usually |
| --- | --- | --- |
| `dashboard-grid` | the number that answers "is anything wrong" | the resting state after the eye has swept the tiles |
| `list` | the filter cutting a long collection down to the few rows that matter | the row they came for, one click from where they were going |
| `list-detail` | the detail pane filling with the row they picked | the list, still in place, with their selection remembered |
| `detail` | the primary action completing | the record's new state, stated in words |
| `form` | the submit resolving | the confirmation, and what happens to the record next |
| `settings` | the switch flipping and the change being real | nothing moved, nothing lost — the quietest end in the app |
| `sequence` | the last step's decision landing | the handover, which is the whole point of a sequence |
| `centered-card` | the credential accepted | the app, arriving |

See [screen-archetypes.md](screen-archetypes.md) for the shapes themselves.

## How this app encodes it

- `scripts/feature-plan.mjs` requires `moments.peak` and `moments.end` per
  surface and renders them into `FEATURE-PLAN.md` above the wireframe, so a
  reviewer reads the intent before the layout.
- `plan-lint` P1 fails a plan that omits either.
- The `ux-prepass` skill's checklist is about *how* a screen is built; this
  document is about *what it is for*, and the two are read together.

Distinctiveness is argued against the category's conventions in
[../references/industry-conventions.md](../references/industry-conventions.md).
