"""ingest and reindex jobs."""

from __future__ import annotations

import asyncio

from app.db import db, jload, rows
from app.jobs import store
from app.rag import ingest


async def _ingest_many(job_id: str, source_ids: list[str], force: bool) -> tuple[int, list[str]]:
    total, errors = 0, []
    for i, sid in enumerate(source_ids):
        store.check_cancel(job_id)
        try:
            total += await ingest.ingest_source(sid, force=force)
        except Exception as e:  # noqa: BLE001 - keep going, the source row records the error
            errors.append(f"{sid}: {e}")
        if len(source_ids) > 1:
            store.emit(job_id, "index", f"Indexed {i + 1} of {len(source_ids)} sources", {"chunks": total})
    return total, errors


async def run_ingest(job: dict) -> dict:
    inp = jload(job["input"], {})
    source_ids: list[str] = list(inp.get("sourceIds") or [])
    if inp.get("noteId"):
        source_ids.append(await asyncio.to_thread(ingest.ensure_note_source, inp["noteId"]))
    if inp.get("courseId"):
        source_ids.extend(await asyncio.to_thread(ingest.ensure_course_sources, inp["courseId"]))
    total, errors = await _ingest_many(job["id"], source_ids, force=bool(inp.get("force")))
    store.emit(job["id"], "index", f"Indexed {total} chunks", {"chunks": total})
    if errors and len(errors) == len(source_ids):
        raise RuntimeError("; ".join(errors)[:500])
    store.emit(job["id"], "done", "Index up to date", {"courseId": inp.get("courseId")} if inp.get("courseId") else {})
    return {"chunks": total, "errors": errors}


async def run_reindex(job: dict) -> dict:
    def all_sources() -> list[str]:
        with db() as conn:
            # Make sure every chapter and note has a source row before re-embedding everything.
            for c in rows(conn, "SELECT id FROM courses WHERE status='ready'"):
                ingest.ensure_course_sources(c["id"])
            for n in rows(conn, "SELECT id FROM note_pages WHERE trashed_at IS NULL"):
                ingest.ensure_note_source(n["id"])
            return [r["id"] for r in rows(conn, "SELECT id FROM sources ORDER BY updated_at")]

    source_ids = await asyncio.to_thread(all_sources)
    total, errors = await _ingest_many(job["id"], source_ids, force=True)
    store.emit(job["id"], "index", f"Re-indexed {total} chunks", {"chunks": total})
    store.emit(job["id"], "done", "Index rebuilt", {})
    return {"chunks": total, "errors": errors}
