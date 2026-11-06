"""Notifications: one row when work you started and are waiting on finishes or fails.

Written from the job worker. A course build or a project review notifies on success and on failure (a build that stops at its outline
for you to review says so); an
ingest notifies only when it fails for a link you added (note and chapter re-indexes stay silent). A
cancelled job writes nothing: you did that yourself. `job_id` is unique, so a job that is re-claimed and
finished twice still notifies once."""

from __future__ import annotations

import logging
import re
import sqlite3

from app.db import db, jload, new_id, now, row

log = logging.getLogger(__name__)

LIMIT = 30


def _one_line(text: str, limit: int = 200) -> str:
    line = " ".join((text or "").split())
    return line if len(line) <= limit else line[: limit - 1] + "…"


def _without_scheme(uri: str) -> str:
    return re.sub(r"^https?://(www\.)?", "", uri).rstrip("/")


def _notice(conn: sqlite3.Connection, job: dict, status: str, error: str | None) -> dict | None:
    kind = job["kind"]
    inp = jload(job.get("input") or "{}", {})
    failed = status == "failed"
    if kind == "build_course" and job.get("course_id"):
        c = row(conn, "SELECT id, title, status FROM courses WHERE id=?", (job["course_id"],))
        if not c:
            return None
        if not failed and c["status"] == "planning":
            # The build stopped at the outline, as asked: nothing is written until you approve it.
            return {
                "kind": "outline_ready",
                "title": f"Outline ready: {c['title']}",
                "body": "Change the chapters by asking, then start writing.",
                "href": f"/courses/{c['id']}/building",
                "course_id": c["id"],
            }
        if failed:
            return {
                "kind": "course_failed",
                "title": f"Build failed: {c['title']}",
                "body": _one_line(error or "The build stopped without a message."),
                "href": f"/courses/{c['id']}/building",
                "course_id": c["id"],
            }
        return {
            "kind": "course_ready",
            "title": f"{c['title']} is ready",
            "body": "Chapters, diagrams and projects are written. Start with chapter 1.",
            "href": f"/courses/{c['id']}",
            "course_id": c["id"],
        }
    if kind == "review_project" and inp.get("submissionId"):
        p = row(
            conn,
            "SELECT p.id, p.title, p.course_id FROM submissions s JOIN projects p ON p.id = s.project_id WHERE s.id=?",
            (inp["submissionId"],),
        )
        if not p:
            return None
        href = f"/courses/{p['course_id']}/projects/{p['id']}"
        if failed:
            return {
                "kind": "review_failed",
                "title": f"Review failed: {p['title']}",
                "body": _one_line(error or "The review stopped without a message."),
                "href": href,
                "course_id": p["course_id"],
            }
        return {
            "kind": "review_ready",
            "title": f"Review ready: {p['title']}",
            "body": "Feedback on your submission is in.",
            "href": href,
            "course_id": p["course_id"],
        }
    if kind == "ingest" and failed and inp.get("sourceIds") and not inp.get("noteId") and not inp.get("courseId"):
        s = row(conn, "SELECT title, uri, error FROM sources WHERE id=? AND kind='url'", (inp["sourceIds"][0],))
        if not s:
            return None
        name = s["title"] if s["title"] and s["title"] != s["uri"] else _without_scheme(s["uri"] or "a link")
        # The source row keeps its own reason; the job's error is prefixed with the source id.
        reason = s["error"] or re.sub(r"^[0-9a-f-]{36}: ", "", error or "")
        return {
            "kind": "source_failed",
            "title": f"Couldn’t index {_one_line(name, 80)}",
            "body": _one_line(reason or "The page could not be read."),
            "href": "/sources",
            "course_id": None,
        }
    return None


def on_job_finished(job: dict, status: str, error: str | None = None) -> None:
    """Record a notice for a job that reached `done` or `failed`. Never raises: a notice is a nicety."""
    if status not in ("done", "failed"):
        return
    try:
        with db() as conn:
            n = _notice(conn, job, status, error)
            if not n:
                return
            conn.execute(
                "INSERT OR IGNORE INTO notifications(id, kind, title, body, href, course_id, job_id, created_at)"
                " VALUES (?,?,?,?,?,?,?,?)",
                (new_id(), n["kind"], n["title"], n["body"], n["href"], n["course_id"], job["id"], now()),
            )
    except Exception:  # noqa: BLE001
        log.exception("could not record a notification for job %s", job.get("id"))


def notification_out(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "kind": r["kind"],
        "title": r["title"],
        "body": r["body"],
        "href": r["href"],
        "courseId": r["course_id"],
        "read": r["read_at"] is not None,
        "createdAt": r["created_at"],
    }
