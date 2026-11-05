from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse

from app.api.common import not_found, ok
from app.db import db, rows
from app.jobs import store

router = APIRouter()

POLL_SECONDS = 0.5


@router.get("/jobs/{job_id}")
def get_job(job_id: str):
    with db() as conn:
        r = store.get_job(conn, job_id)
    if not r:
        raise not_found("Job not found")
    return ok(store.job_out(r))


@router.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    with db() as conn:
        if not store.get_job(conn, job_id):
            raise not_found("Job not found")
    store.request_cancel(job_id)
    with db() as conn:
        return ok(store.job_out(store.get_job(conn, job_id)))


def _poll(job_id: str, after: int) -> tuple[list[dict], str | None]:
    with db() as conn:
        evs = [store.event_out(r) for r in rows(conn, "SELECT * FROM job_events WHERE job_id=? AND seq>? ORDER BY seq", (job_id, after))]
        j = store.get_job(conn, job_id)
    return evs, (j["status"] if j else None)


@router.get("/jobs/{job_id}/events")
async def job_events(job_id: str, request: Request, after: int = Query(0)):
    with db() as conn:
        if not store.get_job(conn, job_id):
            raise not_found("Job not found")
    last_id = request.headers.get("last-event-id")
    if last_id and last_id.isdigit():
        after = max(after, int(last_id))

    async def stream():
        cursor = after
        yield ": connected\n\n"
        idle = 0
        while True:
            events, status = await asyncio.to_thread(_poll, job_id, cursor)
            for ev in events:
                cursor = ev["seq"]
                yield f"id: {ev['seq']}\ndata: {json.dumps(ev, ensure_ascii=False)}\n\n"
                if ev["stage"] == "done":
                    return
            if status is None or (status in ("failed", "cancelled") and not events):
                return
            if status == "done" and not events:
                return
            if await request.is_disconnected():
                return
            idle += 1
            if idle % 30 == 0:
                yield ": keep-alive\n\n"
            await asyncio.sleep(POLL_SECONDS)

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
