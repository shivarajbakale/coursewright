from __future__ import annotations

from fastapi import APIRouter
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
