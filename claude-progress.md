# Progress Log

## Current Verified State

- Repository root: this project
- Standard startup path: `./init.sh`
- Standard verification path: `make check` (install + type-check + lint + test)
- Current highest-priority unfinished feature: course-accuracy-pass (blocked: code landed, live pass on the quant course not run; resume with POST /api/courses/:id/accuracy). prose-clarity passing: STE verb, plain-word, step, paragraph, key-idea and closing checks in agent/app/jobs/precision.py, `make prose-report`; A/B on 8 lessons recorded in its evidence (long sentences 9.6 to 2.7 per 100 after the loop); the prompt shows only good examples because models copy quoted bad ones. Next: the editor pass for synonyms, if wanted. Old job folders whose research/refs.json is a bare list crash Run.vocabulary() (found in the A/B, not fixed). Also: inkling-explainers backfill for five courses waits for the owner's look; reader-pwa-offline home-screen check by the owner; flaky ui-probe M3 on desktop Sources; later per-module skip quiz, later-name leaks in lessons
- Current blocker: none

## Session Log

Earlier sessions: [docs/history/session-013.md](docs/history/session-013.md), [docs/history/session-012.md](docs/history/session-012.md), [docs/history/sessions-008-011.md](docs/history/sessions-008-011.md), [docs/history/sessions-001-007.md](docs/history/sessions-001-007.md).
