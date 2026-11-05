from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api.common import milestone_out, need_claude, not_found, ok, project_out, submission_out
from app.db import db, new_id, now, row, tx
from app.jobs import store

router = APIRouter()

GITHUB_REPO = re.compile(r"^https?://(www\.)?github\.com/[\w.-]+/[\w.-]+/?(\.git)?$")


@router.get("/projects/{project_id}")
def get_project(project_id: str):
    with db() as conn:
        p = project_out(conn, project_id)
    if not p:
        raise not_found("Project not found")
    return ok(p)


class MilestoneIn(BaseModel):
    done: bool


@router.patch("/milestones/{milestone_id}")
def patch_milestone(milestone_id: str, body: MilestoneIn):
    with db() as conn:
        if not row(conn, "SELECT 1 FROM milestones WHERE id=?", (milestone_id,)):
            raise not_found("Milestone not found")
        conn.execute(
            "UPDATE milestones SET done_at=? WHERE id=?",
            (now() if body.done else None, milestone_id),
        )
        return ok(milestone_out(row(conn, "SELECT * FROM milestones WHERE id=?", (milestone_id,))))


class SubmissionIn(BaseModel):
    repoUrl: str
    milestoneId: str | None = None
    focus: str | None = None


@router.post("/projects/{project_id}/submissions", status_code=201)
def create_submission(project_id: str, body: SubmissionIn):
    repo = body.repoUrl.strip()
    if not GITHUB_REPO.match(repo):
        raise HTTPException(status_code=422, detail="repoUrl must be a public GitHub repository URL")
    need_claude()
    with db() as conn, tx(conn):
        p = row(conn, "SELECT course_id FROM projects WHERE id=?", (project_id,))
        if not p:
            raise not_found("Project not found")
        if body.milestoneId and not row(
            conn, "SELECT 1 FROM milestones WHERE id=? AND project_id=?", (body.milestoneId, project_id)
        ):
            raise HTTPException(status_code=422, detail="milestoneId does not belong to this project")
        sid = new_id()
        job_id = store.create_job(conn, "review_project", {"submissionId": sid}, course_id=p["course_id"])
        conn.execute(
            """INSERT INTO submissions(id, project_id, milestone_id, repo_url, focus, status, job_id, created_at)
               VALUES (?,?,?,?,?, 'queued', ?, ?)""",
            (sid, project_id, body.milestoneId, repo, body.focus or "", job_id, now()),
        )
    with db() as conn:
        return ok(submission_out(conn, row(conn, "SELECT * FROM submissions WHERE id=?", (sid,))))


@router.get("/submissions/{submission_id}")
def get_submission(submission_id: str):
    with db() as conn:
        s = row(conn, "SELECT * FROM submissions WHERE id=?", (submission_id,))
        if not s:
            raise not_found("Submission not found")
        return ok(submission_out(conn, s))
