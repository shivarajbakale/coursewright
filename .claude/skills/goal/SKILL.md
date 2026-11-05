---
name: goal
description: Turn a feature into a goal contract — outcome, scope, exclusions, and the checks that decide it is done — then drive maker/checker cycles against it and record what each check returned. Use before starting a feature whose definition of done is not already a command, and whenever work has been going in circles.
---

# goal — write the definition of done before the work

`make check` is a fixed chain. It cannot know that this feature's empty state has
to render when the list is empty, or that someone was meant to look at the
screen. So the feature-specific half of "done" is settled at the end, by whoever
is holding the diff — and it is settled in favour of the diff every time.
Nothing in the repository ever sees the version of "done" that would have failed.

This skill moves that decision to the front, into a file that is written first
and diffed like any other.

## When to skip

Skip when the definition of done really is just a command — a typo, a dependency
bump, a fix with a failing test already in front of you. Writing a contract for
work that is already specified is ceremony. Use it when there is judgement in
"done": a new surface, a behaviour change, anything where two reasonable people
would disagree about whether it shipped.

## Procedure

### 1. Write the contract

Copy `docs/loops/goal-template.json` to `docs/loops/<feature-id>.goal.json` and
fill it in. The feature id must be one the register knows: a `feature_list.json`
entry, or an archived one.

- **`outcome`** — one sentence, phrased as something a user can observe. "The
  orders list has an archive action" is a description of code. "A merchant can
  archive an order without opening it" is an outcome.
- **`scope`** — what this contract covers. Write it before the first edit.
- **`exclusions`** — what it does not cover, however tempting from inside the
  change. This is the field people skip, and it is the one that settles the
  argument three days later. A contract that excludes nothing is refused.
- **`verification`** — the checks. Each needs an `id`, a `check` sentence saying
  what it proves, and exactly one instrument:
  - `command` — an exact command. It must be one this project can run: a `make`
    target that exists, an npm script that exists, or a file that is there. The
    gate resolves it, so an aspirational command fails rather than reads well.
  - `observation` — a person is the instrument. Say where the evidence lands.
    This is not the weak option; it is the honest one for anything a script
    cannot see, and pretending otherwise is how a gate becomes decoration.

### 2. Run the loop

Alternate. Do not collapse the two roles into one pass.

- **maker** — `docs/loops/maker-prompt.md`. Smallest change that could move a
  failing check. Stays inside `scope`. Does not run the checks.
- **checker** — `docs/loops/checker-prompt.md`. Runs each command, records the
  real exit code, looks at each observation and writes what it saw.

The checker appends a cycle to `docs/loops/<feature-id>.loop-state.json` — shape
in `docs/loops/loop-state.schema.json`. Run each side as a subagent when the
harness has them; the separation is the point, and it survives being two prompts
in one session as long as the checker actually runs the commands.

### 3. Stop

The loop ends when a cycle's verdict is `pass`: every check has a result, every
command exited 0, every observation has a note. Set `satisfied` to `true`.

Then the ordinary path — evidence, register status, `make check`, commit. The
loop state is not evidence; it is the record of how the work converged, and it
belongs in the same commit.

### If it does not converge

Three failing cycles on the same check is information about the contract, not
about the code. Stop and say so. Either the check was wrong, or the scope was,
and the contract is the artifact to change — deliberately, in its own commit,
with the reason written down. Never mid-cycle.

## Definition of done for this skill

- `docs/loops/<feature-id>.goal.json` exists and was written before the code.
- `docs/loops/<feature-id>.loop-state.json` records every cycle, with a result
  per check on the passing one.
- `make loop-lint` is green.

## The gate behind this skill

`loop-lint` runs inside `make check`. It is inert in a project with no
contracts and bites on the first one.

| Rule | What it catches |
| --- | --- |
| L1 | A contract that is not one — no outcome, no scope, no exclusions, a check with no instrument or two. |
| L2 | A check naming a command this project cannot run. This is the rule that matters: verification nobody can execute is the failure the contract was supposed to prevent, wearing its costume. |
| L3 | A contract for a feature nobody registered, so nothing will ever verify it. |
| L4 | A loop state written at the end from memory — cycles out of order, a cycle with no maker note, a verdict that is not pass or fail. |
| L5 | A pass with no results behind it: a check that was never run, a command recorded at a non-zero exit, an observation with no note. Also a loop state with no contract. |
| L6 | The register says `passing` while the loop says it never converged. |
| L7 | `loop-state.schema.json` and the gate disagreeing about the required shape — two sources of truth for one artifact, which is how the other drifts start. |
