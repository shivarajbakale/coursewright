# Coursewright agent service

FastAPI + deepagents + LangGraph + SQLite (sqlite-vec + FTS5). Serves the REST API in
`docs/plan/api-contract.md` under `/api`, the tutor over AG-UI at `/agents/tutor`, and runs background jobs
(course builds, ingest, project reviews).

## Commands

```sh
cd agent
uv sync                                              # install
uv run uvicorn app.main:app --port 8123 --reload     # dev server (Vite proxies /api here)
uv run pytest                                        # tests: no network, no keys
```

On first start the service migrates the database, seeds the course "Distributed Systems: consensus with
Raft" (4 modules, 10 chapters, 4 projects, a Mermaid and a Flowmovie diagram), a few nested notes, progress
and quiz attempts (so weak spots show), and indexes it all. Seeding is idempotent. Delete
`agent/data/` to start over.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | unset | Claude (`claude-opus-5-5`). Without it the app still runs: the interview uses four fixed questions, course builds fail with a clear job event, reviews and the tutor return 503. |
| `VOYAGE_API_KEY` | unset | Voyage `voyage-3.5` embeddings (1024 dims) and `rerank-2.5`. Without it a deterministic local hashed bag-of-words embedder (`local-hash-1024`, same dims) is used and rerank is skipped. Switching embedders schedules a reindex at startup. |
| `GITHUB_TOKEN` | unset | Optional, raises GitHub API rate limits for project reviews. |
| `CW_DB_PATH` | `agent/data/coursewright.db` | The SQLite file. Job working folders go in `<dir>/jobs/<job_id>/`. |
| `CW_DISABLE_WORKER` | unset | `1` disables the background job worker (tests). |
| `CW_BUILD_TOKEN_BUDGET` | `4000000` | Token budget per course build; the job fails when exceeded. |
| `CW_CONTEXTUALISE` | `1` | `0` skips Claude chunk contextualisation during ingest (a template context is always added). |

Keys can also go in `agent/.env` (simple `KEY=value` lines).

## Layout

```
app/main.py            FastAPI app, lifespan (migrate, seed, checkpointer, tutor, worker), error envelope, CORS
app/api/               routers (one per resource) + common.py serializers
app/db/                sqlite helpers; migrations/*.sql applied at startup, tracked in schema_version
app/rag/               chunk.py (structure-first), embed.py (voyage | local), ingest.py, search.py (hybrid)
app/jobs/              store (jobs, job_events), worker, build_course, ingest_jobs, review_project
app/agents/            llm.py (model factories), builder.py (deep agent), tutor.py (deep agent + tools)
app/materialise.py     strict Pydantic parsing of a course folder -> course tables in one transaction
app/prompts/*.md       all system prompts
app/seed/raft/         the seed course, in the same folder format the builder writes
```

## How things work

- **SQLite**: one file, WAL, `busy_timeout=5000`, foreign keys on, sqlite-vec loaded on every connection.
  `chunk_vectors` is a `vec0` table (cosine, 1024 floats), `chunks_fts` an FTS5 table; both keyed by
  `chunks.rowid`. LangGraph checkpoints live in the same file (`AsyncSqliteSaver`).
- **Search**: vector top-50 + FTS5 (bm25) top-50, merged by reciprocal rank fusion (k=60), filtered by
  course/chapter/kind, reranked with Voyage when available.
- **Jobs**: `jobs` + `job_events`; the worker claims with `BEGIN IMMEDIATE` + `UPDATE ... RETURNING`, runs up
  to 3 at once, requeues jobs left `running` by a crash. Cancel sets `cancel_requested`, which handlers check
  between steps. SSE (`/api/jobs/:id/events?after=`, or `Last-Event-ID`) replays from the DB then polls every
  0.5 s; it closes after a `done` event or when the job is failed/cancelled.
- **build_course**: `create_deep_agent` orchestrator (effort high) with subagents researcher (Claude
  `web_search` server tool), curriculum, writer, project_designer (effort medium) and reviewer (effort high).
  A `CompositeBackend` routes `/course/` and `/research/` to `FilesystemBackend`s under
  `data/jobs/<job_id>/`. Progress events come from `task` tool calls and from files appearing on disk:
  `research/refs.json` -> research, `course/graph.json` -> concepts, `outline.json` -> outline, each
  `chapters/*.md` -> chapters, `projects/*.json` -> projects. Then materialise, ingest (`index`), `done`.
  The folder format is in `app/prompts/course_format.md`.
- **Tutor**: `create_deep_agent` with `search_course`, `read_chapter`, `read_notes`, `get_progress` and
  `CopilotKitMiddleware`, wrapped in `copilotkit.LangGraphAGUIAgent`, mounted with
  `ag_ui_langgraph.add_langgraph_fastapi_endpoint(app, agent, "/agents/tutor")`. Frontend tools sent in the
  AG-UI `tools` field land in `state.copilotkit.actions`; the middleware adds them to the model's tools and
  intercepts their calls so they run in the browser. Readable context (`context` field, e.g.
  `{description: "courseId", value: "..."}` or one item whose value is a JSON object with
  `courseId/chapterId/selection/noteId`) lands in `state.copilotkit.context`; the middleware appends it to the
  system prompt as "App Context", and the tools read `courseId`/`chapterId` from it for scoping.
- **Models**: `ChatAnthropic(model="claude-opus-5-5", effort=...)` (langchain-anthropic 1.7 sends it as
  `output_config.effort`); never `thinking.budget_tokens` or forced `tool_choice`. One-off calls (interview,
  chunk context, project review) use `anthropic` `messages.parse(output_format=<Pydantic>)`.

## Deviations from docs/plan/architecture.md

- Plain SQL migrations with a `schema_version` table instead of SQLAlchemy + Alembic; raw `sqlite3`.
- Interview is REST (`POST /api/interview/next`, per the contract), not an AG-UI interrupt; no
  `/agents/interviewer`.
- Chapters and notes store markdown only (no JSON block tree column).
- The builder has no separate `diagrammer` subagent or Flowmovie check tool yet; writers may add Mermaid
  diagrams (the seed course has a checked Flowmovie movie). The builder does not use a checkpointer, so a
  crashed build restarts from scratch (its files on disk survive but are not resumed).
- Tutor tools `make_flow`, `make_quiz`, web search and the frontend tools `highlight_passage`/`start_quiz`
  are not implemented.
- Notes are deleted outright (with children); `trashed_at` exists but is unused.
- URL sources are fetched with httpx and stripped of HTML with regexes (no readability/pypdf yet).
