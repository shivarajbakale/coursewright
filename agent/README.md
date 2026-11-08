# Coursewright agent service

FastAPI + deepagents + LangGraph + SQLite (sqlite-vec + FTS5). Serves the REST API in
`docs/plan/api-contract.md` under `/api`, the tutor over AG-UI at `/agents/tutor`, and runs background jobs
(course builds, ingest, project reviews).

## Commands

```sh
cd agent
uv sync                                              # install
uv run uvicorn app.main:app --port 8123 --reload     # dev server (Vite proxies /api here)
uv run pytest                                        # tests: no network, no keys (Node 20+ for the Flowmovie tests)
uv run python -m evals.run tutor|interviewer|builder # evals: prints a cost estimate, needs ANTHROPIC_API_KEY
```

On first start the service migrates the database, seeds the course "Distributed Systems: consensus with
Raft" (4 modules, 10 chapters, 4 projects, a Mermaid and a Flowmovie diagram), a few nested notes, progress
and quiz attempts (so weak spots show), and indexes it all. Seeding is idempotent. Delete
`agent/data/` to start over.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | unset | Claude (`claude-opus-5-5`). Without it the app still runs: the interview uses four fixed questions, course builds fail with a clear job event, reviews and the tutor return 503. |
| `ANTHROPIC_BASE_URL` | unset | An Anthropic-compatible provider instead of Claude, e.g. `https://api.minimax.io/anthropic` for MiniMax. Then `effort`, structured outputs and server web search are off; structured calls use one forced tool call instead. |
| `CW_MODEL` | `claude-opus-5-5` | The model for every agent, e.g. `MiniMax-M3`. |
| `VOYAGE_API_KEY` | unset | Voyage `voyage-3.5` embeddings (1024 dims) and `rerank-2.5`. Without it a deterministic local hashed bag-of-words embedder (`local-hash-1024`, same dims) is used and rerank is skipped. Switching embedders schedules a reindex at startup. |
| `GITHUB_TOKEN` | unset | Optional, raises GitHub API rate limits for project reviews. |
| `CW_DB_PATH` | `agent/data/coursewright.db` | The SQLite file. Job working folders go in `<dir>/jobs/<job_id>/`. |
| `CW_DISABLE_WORKER` | unset | `1` disables the background job worker (tests). |
| `CW_BUILD_TOKEN_BUDGET` | `2000000` | Tokens after which a build skips its optional stages (diagrams, the review pass) and saves the course as written. |
| `CW_CONTEXTUALISE` | `1` | `0` skips Claude chunk contextualisation during ingest (a template context is always added). |
| `CW_SHARED_SECRET` | unset | When set, every `/api/*` and `/agents/*` request must carry header `x-cw-secret` with this value (401 otherwise). `/api/health` and CORS preflights stay open. Unset = no auth (local). |
| `CW_CORS_ORIGINS` | unset | Extra allowed CORS origins, comma separated. |
| `CW_NODE_BIN` | `node` on PATH | Node 18+ binary used for the Flowmovie checker. Without Node, movies can't be checked (so the diagrammer falls back to Mermaid). |
| `LITESTREAM_*` | unset | Deploy only, see below. |

Keys can also go in `agent/.env` (simple `KEY=value` lines).

## Layout

```
app/main.py            FastAPI app, lifespan (migrate, seed, checkpointer, tutor, worker), error envelope, CORS
app/api/               routers (one per resource) + common.py serializers
app/db/                sqlite helpers; migrations/*.sql applied at startup, tracked in schema_version
app/rag/               chunk.py (structure-first), embed.py (voyage | local), ingest.py, search.py (hybrid)
app/jobs/              store (jobs, job_events), worker, build_course, pipeline (the build stages), ingest_jobs,
                       review_project
app/api/plans.py       the outline review: GET plan, chat, remove a chapter, approve
app/agents/            llm.py (model factories, structured output), diagrammer.py (make_movie, make_mermaid,
                       DiagramSaver), tutor.py (deep agent + tools), checkpoint.py (the tutor's AsyncSqliteSaver)
app/flowmovie.py       runs vendor/flowmovie/check.mjs and story.mjs under Node (temp file, 20 s timeout)
app/materialise.py     strict Pydantic parsing of a course folder -> course tables in one transaction
app/prompts/*.md       all system prompts
app/seed/raft/         the seed course, in the same folder format the builder writes
vendor/flowmovie/      Flowmovie 0.6.0 engine (MIT) + check.mjs / story.mjs, copied from the flowmovie skill
evals/                 tutor (30 Raft questions + LLM judge), interviewer (shape checks), builder (rubric)
Dockerfile, start.sh, litestream.yml, fly.toml   deployment (see Deploy)
```

## How things work

- **SQLite**: one file, WAL, `busy_timeout=5000`, foreign keys on, sqlite-vec loaded on every connection.
  `chunk_vectors` is a `vec0` table (cosine, 1024 floats), `chunks_fts` an FTS5 table; both keyed by
  `chunks.rowid`. The tutor's LangGraph checkpoints live in the same file (`AsyncSqliteSaver`).
- **Search**: vector top-50 + FTS5 (bm25) top-50, merged by reciprocal rank fusion (k=60), filtered by
  course/chapter/kind, reranked with Voyage when available.
- **Jobs**: `jobs` + `job_events`; the worker claims with `BEGIN IMMEDIATE` + `UPDATE ... RETURNING`, runs up
  to 3 at once, and leases each job to itself (`worker_id`, `heartbeat_at` updated every 10 s). At start and
  every 10 s it re-claims jobs left `running` by a dead process (another worker id and a heartbeat older than
  45 s): they go back to `queued`, or fail after 3 attempts, or are cancelled if a cancel was requested.
  Cancel sets `cancel_requested`, which handlers check between steps. SSE (`/api/jobs/:id/events?after=`, or
  `Last-Event-ID`) replays from the DB then polls every 0.5 s; it closes after a `done` event or when the job
  is failed/cancelled.
- **build_course**: plain code (`app/jobs/pipeline.py`) runs the stages in order, one structured
  `llm.parse` call per artifact, all files under `data/jobs/<folder>/` (`brief.json`, `research/`,
  `course/`). Plan: research (notes, terms, references), then the curriculum (concepts, edges, modules,
  chapters with a one-line summary), checked in code (at most 14 chapters, every concept taught, every
  prerequisite taught first, chapter 1 has none) with up to two retries naming the problems, then repaired
  in code (untaught concepts and backwards edges dropped). With the brief's `reviewOutline` (the default for
  new courses) the job ends there: the course stays `planning`, a `course_plans` row holds the outline and an
  `outline_ready` notice is written. `POST /courses/:id/plan/approve` queues a second build_course job with
  `{"workdir": <the first job's id>}`. Write: chapters four at a time, each given the brief, the notes, the
  numbered outline, the concepts earlier chapters taught and its own spec, checked in code (`# title`,
  450-1300 words of prose, one `> **Key idea:**`, no "simply/obviously/trivially", 2-4 questions) with one
  retry; diagrams for at most half the chapters; a project per module in order; one review call over the
  whole course and a targeted rewrite of at most four flagged chapters (kept only if it passes the checks).
  Then every `.flow` is checked once more, materialise, ingest (`index`), `done`. Tokens are counted per
  stage (`jobs.usage.stages`).
- **Resume**: Continue re-queues the same job. Every stage skips what is already on disk and valid, so a
  stopped build picks up where it was without asking the model for anything it already has.
- **Diagrams**: writers put a `diagramRequest` (`title`, `show`, `shape: process|structure`) in each
  chapter's `.json`. A `process` becomes a Flowmovie through `make_movie` (prompt = condensed Flowmovie
  syntax + storytelling, `app/prompts/diagrammer.md`): draft, check, feed the errors back, at most four
  tries, then Mermaid. A `structure` becomes Mermaid through `make_mermaid`. `DiagramSaver` checks a movie
  again before it lands. Materialise loads `diagrams/<key>.flow` (kind
  `flow`, preferred) or `.mmd` (kind `mermaid`) into the `diagrams` table, titled from the request.
- **Tutor**: `create_deep_agent` with `search_course`, `read_chapter`, `read_notes`, `get_progress`,
  `make_drawing`, `make_flow`, `make_quiz`, `CopilotKitMiddleware` and `WebSearchToggle`, wrapped in
  `copilotkit.LangGraphAGUIAgent`, mounted with `ag_ui_langgraph.add_langgraph_fastapi_endpoint(app, agent,
  "/agents/tutor")`. Frontend tools sent in the AG-UI `tools` field land in `state.copilotkit.actions`; the
  middleware adds them to the model's tools and intercepts their calls so they run in the browser (the prompt
  knows `save_to_notes`, `open_chapter`, `highlight_passage(chapterId, text)`, `start_quiz(questionsJson)`).
  Readable context (`context` field, e.g. `{description: "courseId", value: "..."}` or one item whose value
  is a JSON object with `courseId/chapterId/selection/noteId/webSearch`) lands in `state.copilotkit.context`;
  the middleware appends it to the system prompt as "App Context", and the tools read it for scoping.
  Tool results (JSON strings):
  - `search_course` -> `{"query", "hits": [{"n", "chunkId", "title", "chapterId", "courseId", "text"}]}`
    (plus `"note"` when empty); the answer cites `[n]`.
  - `make_drawing(spec, layout)` -> `{"kind": "inkling", "title", "source"}`, or `{"kind": "none", "title",
    "note"}`; the source passed the Inkling checker with no warnings and the house rules (title, steps),
    3 tries. The prompt (`app/prompts/drawing.md`) has one checked example per layout, all 13 of Inkling
    1.0, and `test_tutor_drawing` keeps them clean.
  - `make_flow(spec)` -> `{"kind": "flow"|"mermaid", "title", "source"}`; a flow source passed the checker
    (3 tries, then Mermaid).
  - `make_quiz(concept_or_chapter, n)` -> `{"questions": [{"prompt", "options": [...], "answer": <0-based>,
    "explanation", "chapterId"}]}` grounded in that chapter's chunks or a search (plus `"note"` when empty).
  - Web search: `WebSearchToggle` adds Claude's `web_search_20260209` server tool to a model call only when
    the context has `webSearch: true` (checked per model call, so per run).
- **Models**: `ChatAnthropic(model="claude-opus-5-5", effort=...)` (langchain-anthropic 1.7 sends it as
  `output_config.effort`); never `thinking.budget_tokens` or forced `tool_choice`. One-off calls (interview,
  chunk context, project review) use `anthropic` `messages.parse(output_format=<Pydantic>)`.

## Evals

`uv run python -m evals.run tutor|interviewer|builder [--limit N] [--folder PATH] [--estimate]`. Each prints a
cost estimate first and refuses (exit 2) without `ANTHROPIC_API_KEY`. Results go to `evals/results/`.

- `tutor`: 30 questions on the seeded Raft course (`evals/datasets/tutor_raft.json`: 25 in scope with
  expected chapters and key facts, 5 out of scope). Runs the real tutor graph, then automatic checks (cited
  `[n]` in range, expected chapter retrieved/cited) and a claude-opus-5-5 judge for groundedness, citation
  accuracy, key-fact recall and "says when the course doesn't cover it". About $9 a run.
- `interviewer`: 6 topics, answering with the recommended option; checks <= 6 questions, 2-4 distinct
  options, exactly one recommended (on the raw model output), no repeats, a summary at the end. About $2.
- `builder`: grades a built course folder (default the newest `data/jobs/*/course`, or `--folder`):
  structural checks (strict parse, every movie compiles, counts) and a rubric judge over seven criteria.
  About $0.30.

## Deploy

Not deployed yet; this is the intended setup.

- **Agent service on Fly.io** (`agent/fly.toml`, `agent/Dockerfile`): Python 3.12 slim + Node 20 (Flowmovie
  checker) + uv (`uv sync --frozen`) + Litestream. One machine, `auto_stop_machines = "off"` (the job worker
  runs in-process), a volume `cw_data` mounted at `/data`, `CW_DB_PATH=/data/coursewright.db`, internal port
  8123, health check `/api/health`. `fly volumes create cw_data --size 3`, set secrets
  (`ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `CW_SHARED_SECRET`, `LITESTREAM_*`), `fly deploy` from `agent/`.
  Don't scale past one machine: SQLite and the worker are single-node.
- **Litestream** (`agent/litestream.yml`, `agent/start.sh`): with `LITESTREAM_BUCKET` set, the container
  restores the DB from the replica when the volume is empty, then runs uvicorn under `litestream replicate`,
  shipping WAL changes to S3 or Cloudflare R2 (`LITESTREAM_ENDPOINT`, `LITESTREAM_REGION` (`auto` for R2),
  `LITESTREAM_PATH`, `LITESTREAM_ACCESS_KEY_ID`, `LITESTREAM_SECRET_ACCESS_KEY`). Without it the volume alone
  holds the data.
- **Web + CopilotKit runtime on Vercel** (root `vercel.json`): the Vite build is static, `/api/copilotkit` is
  the function in `api/copilotkit/`, every other non-`/api/` path falls back to `index.html`. Set
  `AGENT_URL=https://<app>.fly.dev` and `CW_SHARED_SECRET` (same value as on Fly) in Vercel; whatever calls
  the agent service (the runtime's `HttpAgent` for `/agents/tutor`, and the REST proxy) must send it as the
  `x-cw-secret` header. Add the web origin to `CW_CORS_ORIGINS` if the browser calls the agent directly
  (it can't hold the secret, so prefer proxying through Vercel).

## Deviations from docs/plan/architecture.md

- Plain SQL migrations with a `schema_version` table instead of SQLAlchemy + Alembic; raw `sqlite3`.
- Interview is REST (`POST /api/interview/next`, per the contract), not an AG-UI interrupt; no
  `/agents/interviewer`.
- Chapters and notes store markdown only (no JSON block tree column).
- Diagrams are Flowmovie or Mermaid only (no SVG or graph kind from the diagrammer). Mermaid is not parsed
  server-side, only sanity-checked (first line names a diagram type).
- `make_quiz` takes one concept or chapter id (not a list of concept ids).
- Notes are deleted outright (with children); `trashed_at` exists but is unused.
- URL sources are fetched with httpx and stripped of HTML with regexes (no readability/pypdf yet).
