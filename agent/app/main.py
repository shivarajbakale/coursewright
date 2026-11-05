"""Coursewright agent service: REST under /api, the tutor over AG-UI at /agents/tutor, a job worker."""

from __future__ import annotations

import asyncio
import hmac
import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import config
from app.api import chapters, courses, interview, jobs, notes, notifications, projects, sources
from app.api.common import ok
from app.db import db, init_db, row

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("coursewright")


async def _maybe_schedule_reindex() -> None:
    """Embedder changed (e.g. VOYAGE_API_KEY added): stored vectors live in another space, rebuild them."""
    from app.jobs import store

    with db() as conn:
        stale = row(conn, "SELECT 1 FROM chunks WHERE embed_model != ? LIMIT 1", (config.embed_model(),))
        pending = row(conn, "SELECT 1 FROM jobs WHERE kind='reindex' AND status IN ('queued','running') LIMIT 1")
    if stale and not pending:
        log.info("embedder changed to %s; scheduling a reindex", config.embed_model())
        store.enqueue("reindex", {})


@asynccontextmanager
async def lifespan(app: FastAPI):
    import aiosqlite
    from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

    from app.agents.checkpoint import set_saver
    from app.agents.tutor import init_tutor
    from app.jobs.worker import Worker
    from app.seed import seed_and_index

    await asyncio.to_thread(init_db)
    await _maybe_schedule_reindex()
    try:
        await seed_and_index()
    except Exception:  # noqa: BLE001 - never block startup on the seed
        log.exception("seeding failed")

    conn = await aiosqlite.connect(str(config.db_path()))
    await conn.execute("PRAGMA busy_timeout=30000")
    checkpointer = AsyncSqliteSaver(conn)
    await checkpointer.setup()
    set_saver(checkpointer)  # shared by the tutor and course builds (thread_id = job id, so builds resume)
    await init_tutor(checkpointer)

    worker = Worker()
    if config.worker_enabled():
        worker.start()
    log.info(
        "ready: db=%s anthropic=%s voyage=%s", config.db_path(), bool(config.anthropic_key()), bool(config.voyage_key())
    )
    try:
        yield
    finally:
        await worker.stop()
        set_saver(None)
        await conn.close()


app = FastAPI(title="Coursewright agent", version=config.VERSION, lifespan=lifespan)

OPEN_PATHS = {"/api/health"}


@app.middleware("http")
async def shared_secret(request: Request, call_next):
    """With CW_SHARED_SECRET set, /api/* and /agents/* need header `x-cw-secret` equal to it (health and CORS
    preflights stay open). Unset = no auth, for local development."""
    secret = config.shared_secret()
    path = request.url.path
    if (
        secret
        and request.method != "OPTIONS"
        and (path.startswith("/api") or path.startswith("/agents"))
        and path.rstrip("/") not in OPEN_PATHS
    ):
        given = request.headers.get("x-cw-secret", "")
        if not hmac.compare_digest(given.encode(), secret.encode()):
            return JSONResponse({"message": "Missing or wrong x-cw-secret header"}, status_code=401)
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", *config.cors_origins()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_error(_request: Request, exc: StarletteHTTPException):
    msg = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse({"message": msg}, status_code=exc.status_code, headers=getattr(exc, "headers", None))


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(p) for p in first.get("loc", []) if p != "body")
    return JSONResponse({"message": f"{where}: {first.get('msg', 'invalid request')}".strip(": ")}, status_code=422)


@app.exception_handler(Exception)
async def unhandled(_request: Request, exc: Exception):
    log.exception("unhandled error")
    return JSONResponse({"message": "Internal server error"}, status_code=500)


@app.get("/api/health")
def health():
    return ok(
        {
            "ok": True,
            "anthropic": bool(config.anthropic_key()),
            "voyage": bool(config.voyage_key()),
            "version": config.VERSION,
            "model": config.model(),
            "provider": "anthropic" if config.is_anthropic() else (config.anthropic_base_url() or ""),
        }
    )


for r in (
    interview.router,
    courses.router,
    chapters.router,
    projects.router,
    notes.router,
    sources.router,
    jobs.router,
    notifications.router,
):
    app.include_router(r, prefix="/api")


# ---- AG-UI: tutor ---------------------------------------------------------------------------------


def _require_anthropic() -> None:
    if not config.anthropic_key():
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY is not set")


def _mount_tutor() -> None:
    from ag_ui_langgraph import add_langgraph_fastapi_endpoint

    from app.agents.tutor import tutor_agent

    add_langgraph_fastapi_endpoint(app, tutor_agent, "/agents/tutor", dependencies=[Depends(_require_anthropic)])


_mount_tutor()
