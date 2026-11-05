from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import config
from app.api.common import ok, source_out
from app.db import db, row, rows, tx
from app.jobs import store
from app.rag.ingest import upsert_source
from app.rag.search import hybrid_search

router = APIRouter()


@router.get("/sources")
def list_sources():
    with db() as conn:
        return ok([source_out(r) for r in rows(conn, "SELECT * FROM sources ORDER BY updated_at DESC")])


@router.get("/sources/stats")
def stats():
    with db() as conn:
        r = row(
            conn,
            """SELECT (SELECT COUNT(*) FROM sources) AS sources, (SELECT COUNT(*) FROM chunks) AS chunks,
                      (SELECT COUNT(DISTINCT course_id) FROM chunks WHERE course_id IS NOT NULL) AS courses""",
        )
    return ok(
        {
            "sources": r["sources"],
            "chunks": r["chunks"],
            "courses": r["courses"],
            "embedModel": config.embed_model(),
            "dims": config.EMBED_DIMS,
            "embedder": config.embedder_kind(),
        }
    )


class SourceIn(BaseModel):
    kind: str = "url"
    uri: str = Field(min_length=1)


@router.post("/sources", status_code=201)
def add_source(body: SourceIn):
    if body.kind != "url":
        raise HTTPException(status_code=422, detail="only kind 'url' can be added")
    uri = body.uri.strip()
    if not uri.startswith(("http://", "https://")):
        raise HTTPException(status_code=422, detail="uri must be an http(s) URL")
    with db() as conn, tx(conn):
        sid = upsert_source(conn, kind="url", ref_id=uri, title=uri, uri=uri)
        conn.execute("UPDATE sources SET status='pending', error=NULL WHERE id=?", (sid,))
        store.create_job(conn, "ingest", {"sourceIds": [sid]})
        return ok(source_out(row(conn, "SELECT * FROM sources WHERE id=?", (sid,))))


@router.post("/sources/reindex")
def reindex():
    return ok({"jobId": store.enqueue("reindex", {})})


class SearchIn(BaseModel):
    query: str
    courseId: str | None = None
    k: int = Field(default=6, ge=1, le=20)


@router.post("/search/test")
async def search_test(body: SearchIn):
    return ok(await hybrid_search(body.query, k=body.k, course_id=body.courseId))
