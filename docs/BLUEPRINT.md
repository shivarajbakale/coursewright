# Blueprint Protocol

The blueprint is the **at-a-glance design** the agent produces from a
user's app brief, so the user can sanity-check the shape of the app
before any code is written.

Live blueprint lives at [`BLUEPRINT.md`](../BLUEPRINT.md) (repo root).
This doc explains the protocol around it.

## When to produce a blueprint

The blueprint step runs **before** `feature_list.json` is populated,
whenever:

1. `BLUEPRINT.md` is still in stub form (no one-liner, **Approved** not
   ticked), AND
2. the user has described an app — anything from a one-paragraph brief
   to a multi-page PRD.

If `BLUEPRINT.md` is already approved, skip this protocol — the agent
is in implementation mode against the existing blueprint.

## What goes in it

The blueprint must fit on roughly **one screen** of scrolling. If you
need more, you're designing, not blueprinting. Sections:

| Section            | Why it's there                                          |
| ------------------ | ------------------------------------------------------- |
| One-liner          | A single sentence the user can sanity-check            |
| Screens table      | Name + route + layout template + purpose               |
| Navigation map     | ASCII tree so route relationships are obvious          |
| Data model         | Entities + key fields — enough to spot missing ones    |
| State              | What lives in TanStack Query vs Zustand                |
| Backend            | Mock route signatures (real backend can come later)    |
| Open questions     | Decisions the agent flagged for the user               |

Each row in the `Screens` table maps directly to:

- `Route`: the path registered in
  [src/router/router.tsx](../src/router/router.tsx).
- `Layout`: one of the templates in
  [FEATURES.md → Pick a page layout](FEATURES.md#3-pick-a-page-layout).

That mapping is the whole point — the blueprint isn't decorative, it
is the spec the agent will mechanically expand into page files,
routes, and feature entries.

## The approval gate

The user ticks `[x] approved`. **No `feature_list.json` mutation
happens before this.** The agent may grep, read, and propose, but it
does not start implementation until that box is ticked.

After approval, the agent:

1. Records the approval timestamp in `claude-progress.md`.
2. Splits the blueprint into `feature_list.json` entries — one per
   screen by default; a single screen may become multiple entries if
   it has substantial sub-behaviours (CRUD form, filtered list, etc.).
3. Each new feature's `notes` field references the screen `#` from
   the blueprint table.

## Editing an approved blueprint

If scope shifts after approval:

1. Append a `## Revision YYYY-MM-DD` section at the bottom of
   `BLUEPRINT.md` describing what changed and why.
2. Add a [`DECISIONS.md`](../DECISIONS.md) entry.
3. Add or revise `feature_list.json` entries to match — do not edit
   existing `passing` entries to absorb the new scope; create new
   entries.

The blueprint is append-mostly after approval. Treat it like an ADR
for the app's shape.

## What this protocol is not

- Not a wireframe / Figma replacement — it's a structural
  alignment doc, not a visual one.
- Not a substitute for [DECISIONS.md](../DECISIONS.md) — significant
  architectural choices (auth strategy, persistence layer, routing
  changes) still belong there.
- Not auto-generated — the agent writes it from the brief; the user
  reviews it; both treat the file as the contract.
