"""A small asyncio worker: claims queued jobs (BEGIN IMMEDIATE + UPDATE ... RETURNING) and runs them."""

from __future__ import annotations

import asyncio
import logging
import traceback
from typing import Awaitable, Callable

from app.jobs import store

log = logging.getLogger(__name__)

MAX_CONCURRENT = 3
POLL_SECONDS = 0.5


def _handlers() -> dict[str, Callable[[dict], Awaitable[dict | None]]]:
    from app.jobs import build_course, ingest_jobs, review_project

    return {
        "build_course": build_course.run,
        "ingest": ingest_jobs.run_ingest,
        "reindex": ingest_jobs.run_reindex,
        "review_project": review_project.run,
    }


async def run_job(job: dict) -> None:
    job_id = job["id"]
    handler = _handlers().get(job["kind"])
    try:
        if handler is None:
            raise RuntimeError(f"no handler for job kind {job['kind']}")
        output = await handler(job)
        store.finish(job_id, "done", output=output or {})
    except store.Cancelled:
        store.finish(job_id, "cancelled", error="Cancelled")
        await _on_failure(job, "Cancelled", cancelled=True)
    except Exception as e:  # noqa: BLE001
        msg = str(e) or e.__class__.__name__
        log.error("job %s (%s) failed: %s\n%s", job_id, job["kind"], msg, traceback.format_exc())
        store.finish(job_id, "failed", error=msg)
        await _on_failure(job, msg, cancelled=False)


async def _on_failure(job: dict, msg: str, cancelled: bool) -> None:
    from app.jobs import build_course, review_project

    try:
        if job["kind"] == "build_course":
            await asyncio.to_thread(build_course.mark_failed, job, msg)
        elif job["kind"] == "review_project":
            await asyncio.to_thread(review_project.mark_failed, job, msg)
    except Exception:  # noqa: BLE001
        log.exception("failure hook crashed")


class Worker:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._running: set[asyncio.Task] = set()
        self._stop = asyncio.Event()

    def start(self) -> None:
        store.requeue_orphans()
        self._task = asyncio.create_task(self._loop(), name="job-worker")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
        for t in list(self._running):
            t.cancel()
        await asyncio.gather(*(t for t in [self._task, *self._running] if t), return_exceptions=True)

    async def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                if len(self._running) < MAX_CONCURRENT:
                    job = await asyncio.to_thread(store.claim_next)
                    if job is not None:
                        t = asyncio.create_task(run_job(dict(job)), name=f"job-{job['id']}")
                        self._running.add(t)
                        t.add_done_callback(self._running.discard)
                        continue
                await asyncio.sleep(POLL_SECONDS)
            except asyncio.CancelledError:
                raise
            except Exception:  # noqa: BLE001
                log.exception("worker loop error")
                await asyncio.sleep(2)


async def drain(max_jobs: int = 50) -> int:
    """Run queued jobs inline until none are left (used by seeding without a worker and by tests)."""
    n = 0
    while n < max_jobs:
        job = await asyncio.to_thread(store.claim_next)
        if job is None:
            return n
        await run_job(dict(job))
        n += 1
    return n
