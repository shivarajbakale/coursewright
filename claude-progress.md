# Progress Log

## Current Verified State

- Repository root: this project
- Standard startup path: `./init.sh`
- Standard verification path: `make check` (install + type-check + lint + test)
- Current highest-priority unfinished feature: none open (inkling-explainers passing: harness course backfilled; other five courses wait for the owner's look); next reader Phase 4 PWA; design canvas https://claude.ai/artifact/LUdrDTLccSWPURFiLgHjYS; flaky ui-probe M3 on desktop Sources (2 of 3 full make check runs); later per-module skip quiz, later-name leaks in lessons
- Current blocker: none

## Session Log

### Session 013 — Inkling explainers (2026-11-07)

- Every chapter can carry 1-2 Inkling explainers as ```inkling fences (vendor/inkling, agent/vendor/inkling).
  Builder stage + backfill job (POST /api/courses/:id/explainers); generated drawings must pass the checker
  with no warnings; steps that draw nothing are removed in code (Inkling drops them silently).
- Harness course backfilled (65/65, 90 explainers) and synced to courses/agent-harness-from-scratch. The
  other five courses wait for the owner. Wide drawings turn top to bottom on phones (source directive;
  the mount option is ignored by mind maps).

Earlier sessions: [docs/history/session-012.md](docs/history/session-012.md), [docs/history/sessions-008-011.md](docs/history/sessions-008-011.md), [docs/history/sessions-001-007.md](docs/history/sessions-001-007.md).
