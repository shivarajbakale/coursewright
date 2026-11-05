<!-- ux-layer:v1 -->

# UX Patterns

Every screen follows the same rules. Deviating requires a DECISIONS.md entry.

These are the patterns *inside* a screen. The screen's overall shape is chosen
first, from the seven in
[principles/screen-archetypes.md](principles/screen-archetypes.md) — the four
states below are the four states of whichever archetype you picked.

The reasoning behind these patterns lives one level up, and a rule you want to
argue with is argued with there, not here:

| Read | When |
| --- | --- |
| [principles/screen-archetypes.md](principles/screen-archetypes.md) | choosing the shape of a screen |
| [principles/emotional-design.md](principles/emotional-design.md) | deciding what the user takes away — the peak and the end |
| [principles/nielsen-heuristics.md](principles/nielsen-heuristics.md) | judging whether a flow is usable, not merely built |
| [principles/component-selection.md](principles/component-selection.md) | choosing between two controls that both work |
| [the Mantine capability map](../.claude/skills/use-mantine/mantine-capabilities.md) | what one family is for, and the gotcha inside it |
| [principles/depth-and-materials.md](principles/depth-and-materials.md) | deciding which surface sits above which |
| [principles/spacing-and-type.md](principles/spacing-and-type.md) | sizing anything |
| [principles/motion.md](principles/motion.md) | anything moves |
| [principles/microcopy.md](principles/microcopy.md) | writing a word the user will read |
| [principles/wcag-2.2-aa.md](principles/wcag-2.2-aa.md) | the accessibility floor the `a11y` gate enforces |
| [references/industry-conventions.md](references/industry-conventions.md) | Step 0 — what this product's category has trained users to expect |

## The four states (non-negotiable)

Every async surface renders all four states. Missing any one is a bug:

1. **Loading** — skeleton or spinner; never a blank region.
2. **Empty** — explain what will appear here and give one action to create it.
3. **Error** — human-readable message + retry action; never raw error text.
4. **Success** — the data, or explicit confirmation when there is nothing to show.

## List-page anatomy

- Page title + primary action top-right ("New thing").
- Filter/search above the list; sort on the column, not a separate control.
- Rows: identity first, metadata second, row actions last (icon buttons with labels).
- Pagination or infinite scroll — never an unbounded render.

## Form layout

- One column; label above field; helper text below; error text replaces helper text.
- Validate on submit first, on blur after first submit.
- Primary button bottom-right, disabled while submitting; never a double-submit.
- Cancel is a ghost/link button, never a second filled button.

## Modal vs inline confirm

- Destructive or irreversible -> modal confirm naming the object ("Delete 'Acme'?").
- Trivial/reversible (archive, toggle) -> inline optimistic update + undo toast.
- Never a modal for pure information display.

## Empty-state copy rules

- Say what belongs here, why it's empty, and what to do next — three short lines max.
- Always end with exactly one call-to-action button.
- No illustrations required; no lorem text ever.
