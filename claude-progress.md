# Progress Log

## Current Verified State

- Repository root: this project
- Standard startup path: `./init.sh`
- Standard verification path: `make check` (install + type-check + lint + test)
- Current highest-priority unfinished feature: course-accuracy-pass (in progress). Live pass ran on the Mac mini server: job acced2dc-5fb8-4786-9892-37a91d609fdb, 88 lessons, mistakes found in 54, corrections proposed for 31, none applied, 328 calls (581k in / 249k out tokens). The server predates 2193137, so GET /jobs/:id/output returns 404 there: redeploy (ts-deploy) to read the proposals, then check each by computation. prose-clarity passing: STE verb, plain-word, step, paragraph, key-idea and closing checks in agent/app/jobs/precision.py, `make prose-report`; A/B on 8 lessons recorded in its evidence (long sentences 9.6 to 2.7 per 100 after the loop); the prompt shows only good examples because models copy quoted bad ones. Next: the editor pass for synonyms, if wanted. Also: inkling-explainers backfill for five courses waits for the owner's look; reader-pwa-offline home-screen check by the owner; flaky ui-probe M3 on desktop Sources; later per-module skip quiz, later-name leaks in lessons
- Current blocker: none

## Session Log

Earlier sessions: [docs/history/session-013.md](docs/history/session-013.md), [docs/history/session-012.md](docs/history/session-012.md), [docs/history/sessions-008-011.md](docs/history/sessions-008-011.md), [docs/history/sessions-001-007.md](docs/history/sessions-001-007.md).
