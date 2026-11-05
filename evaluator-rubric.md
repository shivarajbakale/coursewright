# Evaluator Rubric

Use this rubric after implementation and before final acceptance. Each row
is scored 0 (fails), 1 (partial), or 2 (meets bar).

| Category          | Question                                                                       | Score (0-2) | Notes |
| ----------------- | ------------------------------------------------------------------------------ | ----------- | ----- |
| Correctness       | Does the implemented behavior match the `user_visible_behavior` field?         |             |       |
| Verification      | Did the `verification` commands actually run, with evidence captured?          |             |       |
| Scope discipline  | Did the session stay inside the chosen feature scope?                          |             |       |
| Reliability       | Does `./init.sh` still pass after the change?                                  |             |       |
| Maintainability   | Is the code self-explanatory; do non-obvious choices have a `DECISIONS.md` entry? |             |       |
| Design system    | Does every new UI element use an existing atom/molecule rather than hand-rolled markup (`<table>`, `<textarea>`, `<input>`, progress bars, segmented controls)? |             |       |
| Layout contract  | Does the change keep the shell a fixed viewport — no `overflow-y-auto` outside the design system, headers pinned, scroll inside `PageShell`? |             |       |
| Handoff readiness | Can a fresh session continue from repo artifacts alone (no chat needed)?       |             |       |
| UI pre-pass | The change handles loading/empty/error/success, keeps tap targets >= 44pt (48dp flutter), visible focus states, dark-mode tokens, safe text overflow, keyboard navigation, and composes every primitive from the design system rather than hand-rolling it (`npm run ui-lint` green). |  |  |

## Visual Quality

Screenshots only. Score these from the rendered screens, not from the diff — the
agent that wrote the change is not the one that should judge how it looks.

| Category          | Question                                                                         | Score (0-2) | Notes |
| ----------------- | -------------------------------------------------------------------------------- | ----------- | ----- |
| Renders           | Does every touched screen render real content at all three viewports?            |             |       |
| Layout invariants | Does `make ui-probe` pass with zero violations?                               |             |       |
| Hierarchy         | Is there one clear entry point, and does visual weight track semantic rank?      |             |       |
| Density           | Does spacing group related things and separate unrelated ones?                   |             |       |
| States            | Are empty, loading, and error states present and designed, not afterthoughts?    |             |       |
| Tokens            | Zero raw hex, shadow, font, or duration literals in the diff?                    |             |       |
| Motion            | Do transitions use token durations and respect `prefers-reduced-motion`?        |             |       |
| Consistency       | Does the change match the shipped primitives rather than introducing a parallel style? |       |       |
| Control fit       | Is each control the right one for the job (`docs/principles/component-selection.md`) — not merely a legal atom from the kit? |             |       |

## Verdict

- [ ] Accept
- [ ] Revise
- [ ] Block

## Required Follow-Up

- Missing evidence:
- Required fixes:
- Next review trigger:
