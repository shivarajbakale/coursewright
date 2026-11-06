"""A small asyncio worker: claims queued jobs (BEGIN IMMEDIATE + UPDATE ... RETURNING) and runs them.

Each claimed job is leased to this process (`jobs.worker_id`) and heartbeated every HEARTBEAT_SECONDS. At
start and then periodically, jobs left 'running' by a dead process (stale heartbeat) are re-claimed: put back
in the queue, so the next claim runs them again (build_course resumes its checkpointed thread)."""

from __future__ import annotations

import asyncio
import logging
import time
import traceback
from typing import Awaitable, Callable

from app import notify
from app.jobs import store

log = logging.getLogger(__name__)

MAX_CONCURRENT = 3
POLL_SECONDS = 0.5


def _handlers() -> dict[str, Callable[[dict], Awaitable[dict | None]]]:
    from app.jobs import build_course, explainers, ingest_jobs, review_project

    return {
        "build_course": build_course.run,
        "explainers": explainers.run,
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
        await asyncio.to_thread(notify.on_job_finished, job, "done")
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
    if not cancelled:
        # After the hook, so a failed build's course row already reads 'failed'.
        await asyncio.to_thread(notify.on_job_finished, job, "failed", msg)


async def reclaim() -> None:
    """Requeue orphans of a dead process; run failure hooks for the ones that ran out of attempts."""
    res = await asyncio.to_thread(store.reclaim_stale)
    for j in res["requeued"]:
        log.info("re-claimed job %s (%s) left running by %s", j["id"], j["kind"], j["worker_id"])
    for j in res["failed"]:
        log.warning("job %s (%s): %s", j["id"], j["kind"], j["error"])
        await _on_failure(j, j["error"], cancelled=False)
    for j in res["cancelled"]:
        await _on_failure(j, "Cancelled", cancelled=True)


class Worker:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._running: dict[asyncio.Task, str] = {}
        self._stop = asyncio.Event()
        self._last_beat = 0.0
        self._last_reclaim = 0.0

    def start(self) -> None:
        self._task = asyncio.create_task(self._loop(), name="job-worker")

    async def stop(self) -> None:
        self._stop.set()
        if self._task:
            self._task.cancel()
        for t in list(self._running):
            t.cancel()
        await asyncio.gather(*(t for t in [self._task, *self._running] if t), return_exceptions=True)

    async def _housekeeping(self) -> None:
        t = time.monotonic()
        if t - self._last_beat >= store.HEARTBEAT_SECONDS:
            self._last_beat = t
            await asyncio.to_thread(store.heartbeat, list(self._running.values()))
        if t - self._last_reclaim >= store.HEARTBEAT_SECONDS:
            self._last_reclaim = t
            await reclaim()

    async def _loop(self) -> None:
        while not self._stop.is_set():
            try:
                await self._housekeeping()
                if len(self._running) < MAX_CONCURRENT:
                    job = await asyncio.to_thread(store.claim_next)
                    if job is not None:
                        t = asyncio.create_task(run_job(dict(job)), name=f"job-{job['id']}")
                        self._running[t] = job["id"]
                        t.add_done_callback(lambda done: self._running.pop(done, None))
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
