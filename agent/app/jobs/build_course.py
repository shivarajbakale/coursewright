"""build_course job: run the course pipeline (app/jobs/pipeline.py), then save the course and index it.

A job's input is `{"brief": ..., "workdir": <folder id>?}`. A new build plans (research, outline) and, when
the brief asks to review the outline, ends there with the course still 'planning'; approving the outline
queues a second build_course job on the same folder, which writes the rest. A build whose brief doesn't
ask (and every build from before the review existed) runs straight through. Re-running a job (Continue)
skips every file already on disk and valid.
"""

from __future__ import annotations

import asyncio
import logging

from app import config
from app.agents.diagrammer import validate_course_diagrams
from app.db import db, jload, now, row
from app.jobs import pipeline, store
from app.materialise import MaterialiseError, parse_course_folder, write_course
from app.rag import ingest

log = logging.getLogger(__name__)

def last_stage(job_id: str) -> str:
    with db() as conn:
        r = row(conn, "SELECT stage FROM job_events WHERE job_id=? ORDER BY seq DESC LIMIT 1", (job_id,))
    return r["stage"] if r and r["stage"] != "done" else "research"


def mark_failed(job: dict, msg: str) -> None:
    if job.get("course_id"):
        with db() as conn:
            conn.execute("UPDATE courses SET status='failed' WHERE id=? AND status!='ready'", (job["course_id"],))


def _plan_row(course_id: str):
    with db() as conn:
        return row(conn, "SELECT * FROM course_plans WHERE course_id=?", (course_id,))


def _record_plan(course_id: str, workdir: str, outline, approved: bool) -> None:
    at = now()
    with db() as conn:
        conn.execute(
            """INSERT INTO course_plans(course_id, outline, messages, workdir, approved_at, created_at, updated_at)
               VALUES (?,?, '[]', ?,?,?,?) ON CONFLICT(course_id) DO NOTHING""",
            (course_id, outline.model_dump_json(by_alias=True), workdir, at if approved else None, at, at),
        )


def _set_status(course_id: str, status: str) -> None:
    with db() as conn:
        conn.execute("UPDATE courses SET status=? WHERE id=? AND status!='ready'", (status, course_id))


async def run(job: dict) -> dict:
    job_id = job["id"]
    course_id = job["course_id"]
    inp = jload(job["input"], {})
    brief = inp.get("brief") or {}
    if not config.anthropic_key():
        msg = "ANTHROPIC_API_KEY is not set"
        store.emit(job_id, "research", f"Can't build the course: {msg}", {"error": msg})
        raise RuntimeError(msg)

    workdir_id = inp.get("workdir") or job_id
    workdir = config.jobs_dir() / workdir_id
    workdir.mkdir(parents=True, exist_ok=True)
    if not (workdir / "brief.json").exists():
        import json

        (workdir / "brief.json").write_text(json.dumps(brief, indent=2))  # for evals and debugging
    await asyncio.to_thread(_set_status, course_id, "building")
    ledger = pipeline.Ledger(job_id, jload(job.get("usage"), None))
    p = pipeline.Run(job_id, workdir, brief, ledger)

    plan = await asyncio.to_thread(_plan_row, course_id)
    if plan is None or not (workdir / "course" / "outline.json").exists():
        outline = await p.plan()
        review = bool(brief.get("reviewOutline"))
        await asyncio.to_thread(_record_plan, course_id, workdir_id, outline, not review)
        plan = await asyncio.to_thread(_plan_row, course_id)
    if plan["approved_at"] is None:
        await asyncio.to_thread(_set_status, course_id, "planning")
        await p.emit("outline", "The outline is ready for you to review", {"review": True})
        return {"courseId": course_id, "phase": "plan", "usage": ledger.usage()}

    outline = p.outline()
    if outline is None:
        raise RuntimeError("The course outline is missing. Start a new course.")
    await p.write(outline)
    await _finish(job_id, course_id, workdir, p)
    return {"courseId": course_id, "phase": "write", "usage": ledger.usage()}


async def _finish(job_id: str, course_id: str, job_dir, progress: "pipeline.Run") -> None:
    await asyncio.to_thread(store.check_cancel, job_id)

    rejected = await asyncio.to_thread(validate_course_diagrams, job_dir / "course")
    if rejected:
        await progress.emit("chapters", f"Dropped {len(rejected)} movie(s) that don't compile", {"rejected": rejected})

    try:
        parsed = await asyncio.to_thread(parse_course_folder, job_dir / "course")
    except MaterialiseError as e:
        raise RuntimeError(f"The generated course files are invalid: {e}") from e

    def save() -> None:
        with db() as conn:
            c = row(conn, "SELECT brief FROM courses WHERE id=?", (course_id,))
            if not c:
                raise store.Cancelled()  # course deleted mid-build
            write_course(conn, parsed, course_id=course_id)

    await asyncio.to_thread(save)
    await progress.emit("index", "Indexing the course for the tutor", {"chunks": 0})
    chunks = await ingest.ingest_course(course_id)
    await progress.emit("index", f"Indexed {chunks} passages", {"chunks": chunks})
    await progress.emit("done", "Your course is ready", {"courseId": course_id})
