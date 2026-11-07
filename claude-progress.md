# Progress Log

## Current Verified State

- Repository root: this project
- Standard startup path: `./init.sh`
- Standard verification path: `make check` (install + type-check + lint + test)
- Current highest-priority unfinished feature: none open. course-accuracy-pass passing: the live quant pass proposed 31 corrections, and checking by computation kept 7 (verdicts and exact edits in docs/accuracy/quant-2026-11-07.json, applied 2026-11-07 on the live course with PATCH /chapters/:id and in courses/quant-trading-from-scratch, live and local match). The server on the Mac mini runs code from before 2193137; the deploy (npm run deploy) was blocked by the permission classifier and waits for the owner. prose-clarity passing: STE verb, plain-word, step, paragraph, key-idea and closing checks in agent/app/jobs/precision.py, `make prose-report`; A/B on 8 lessons recorded in its evidence (long sentences 9.6 to 2.7 per 100 after the loop); the prompt shows only good examples because models copy quoted bad ones. Next: the editor pass for synonyms, if wanted. Also: inkling-explainers backfill for five courses waits for the owner's look; reader-pwa-offline home-screen check by the owner; flaky ui-probe M3 on desktop Sources; later per-module skip quiz, later-name leaks in lessons
- Current blocker: none

## Session Log

Earlier sessions: [docs/history/session-013.md](docs/history/session-013.md), [docs/history/session-012.md](docs/history/session-012.md), [docs/history/sessions-008-011.md](docs/history/sessions-008-011.md), [docs/history/sessions-001-007.md](docs/history/sessions-001-007.md).
