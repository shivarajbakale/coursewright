# Design Decisions

Append-only. New entries go at the top. Each entry should answer:

- **What** changed
- **Why** (the forcing function — constraint, deadline, stakeholder ask, bug)
- **Rejected alternatives** (and why)
- **Constraint or invariant** the decision creates (so future agents know what
  they can't silently undo)

---

## 2026-11-05 — Storybook stories are optional

- **What:** storybook-lint rule R8 (every composite in `src/components/` needs a sibling story and a
  taxonomy entry) is retired. Existing stories are still linted by R1–R7 and R9.
- **Why:** the owner considers writing stories a waste for this personal app.
- **Rejected:** keeping R8 and writing stories anyway; dropping storybook-lint entirely (the remaining
  rules still catch broken stories that exist).
- **Constraint:** don't add stories by default; components are verified by tests and the UI probe.
