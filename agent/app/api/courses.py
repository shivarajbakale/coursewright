from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.api.common import course_detail, get_course_summary, list_courses, not_found, ok
from app.db import db, jdump, new_id, now, row, rows, set_meta, tx
from app.jobs import store
from app.rag.chunk import slugify
from app.rag.ingest import delete_source

router = APIRouter()


class Answer(BaseModel):
    question: str
    answer: list[str] = []


class CourseBrief(BaseModel):
    topic: str = Field(min_length=1)
    answers: list[Answer] = []
    level: str | None = None
    goal: str | None = None
    pace: str | None = None
    # Stop after the outline so the learner can reshape it before any chapter is written.
    reviewOutline: bool = True


class CreateCourse(BaseModel):
    brief: CourseBrief


@router.get("/courses")
def get_courses():
    with db() as conn:
        return ok(list_courses(conn))


@router.post("/courses", status_code=201)
def create_course(body: CreateCourse):
    brief = body.brief.model_dump(exclude_none=True)
    with db() as conn, tx(conn):
        cid = new_id()
        topic = body.brief.topic.strip()
        conn.execute(
            """INSERT INTO courses(id, title, slug, topic, summary, brief, status, colour, icon, created_at)
               VALUES (?,?,?,?, '', ?, 'planning', 'lime', '', ?)""",
            (cid, topic, slugify(topic), topic, jdump(brief), now()),
        )
        job_id = store.create_job(conn, "build_course", {"brief": brief}, course_id=cid)
        conn.execute("UPDATE courses SET job_id=? WHERE id=?", (job_id, cid))
    with db() as conn:
        return ok({"course": get_course_summary(conn, cid), "jobId": job_id})


class ImportCourse(BaseModel):
    # {relative path: text}: outline.json, chapters/<key>.md|json, diagrams/<key>.flow|mmd, projects/<key>.json
    files: dict[str, str] = Field(min_length=1)
    replace: bool = False
    strict: bool = False


MAX_IMPORT_BYTES = 8_000_000


@router.post("/courses/import", status_code=201)
async def import_course(body: ImportCourse):
    """A course folder written outside the builder (by a coding agent, see docs/authoring-courses.md), sent as
    files: checked like `python -m app.cli check`, then saved as a ready course and indexed for the tutor."""
    import asyncio
    import tempfile
    from pathlib import Path

    from fastapi.responses import JSONResponse

    from app import authoring, config
    from app.rag import ingest

    if sum(len(t) for t in body.files.values()) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="The course is over 8 MB")
    with tempfile.TemporaryDirectory(prefix="cw-import-") as d:
        folder = Path(d)
        refused = authoring.write_bundle(body.files, folder)
        if refused:
            raise HTTPException(status_code=422, detail=f"Not a course file: {', '.join(sorted(refused)[:10])}")
        report = await asyncio.to_thread(authoring.check_folder, folder)
        if not report.ok(body.strict):
            return JSONResponse(status_code=422, content={"message": "The course has problems", "report": report.as_dict()})

        def save() -> tuple[str, bool]:
            with db() as conn:
                return authoring.import_folder(conn, folder, replace=body.replace)

        try:
            course_id, created = await asyncio.to_thread(save)
        except authoring.ImportConflict as e:
            raise HTTPException(status_code=409, detail=str(e)) from e
    await ingest.ingest_course(course_id, llm_context=bool(config.anthropic_key()))
    with db() as conn:
        return ok({"course": get_course_summary(conn, course_id), "created": created, "report": report.as_dict()})


@router.post("/courses/{course_id}/resume")
def resume_course(course_id: str):
    """Continue a build that stopped: the same job runs again from its checkpoint and the files on disk."""
    with db() as conn:
        c = row(conn, "SELECT id, job_id, status FROM courses WHERE id=?", (course_id,))
    if not c:
        raise not_found("Course not found")
    if c["status"] == "ready" or not c["job_id"]:
        raise HTTPException(status_code=409, detail="This course has no stopped build to continue")
    if not store.resume(c["job_id"]):
        raise HTTPException(status_code=409, detail="The build is still running")
    from app.jobs.build_course import last_stage

    store.emit(c["job_id"], last_stage(c["job_id"]), "Continuing the build where it stopped", {"resumed": True})
    with db() as conn:
        conn.execute("UPDATE courses SET status='building' WHERE id=?", (course_id,))
        return ok({"course": get_course_summary(conn, course_id), "jobId": c["job_id"]})


@router.get("/courses/{course_id}")
def get_course(course_id: str):
    with db() as conn:
        detail = course_detail(conn, course_id)
    if not detail:
        raise not_found("Course not found")
    return ok(detail)


@router.delete("/courses/{course_id}")
def delete_course(course_id: str):
    with db() as conn:
        c = row(conn, "SELECT id, job_id, seed_key FROM courses WHERE id=?", (course_id,))
        if not c:
            raise not_found("Course not found")
        if c["job_id"]:
            store.request_cancel(c["job_id"])
        with tx(conn):
            for s in rows(conn, "SELECT id FROM sources WHERE course_id=? AND kind='chapter'", (course_id,)):
                delete_source(conn, s["id"])
            conn.execute("DELETE FROM courses WHERE id=?", (course_id,))
            if c["seed_key"]:
                set_meta(conn, "seed.course", "deleted")
    return ok({"ok": True})
