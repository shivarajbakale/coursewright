"""Notifications: the worker writes one per finished or failed build, review and added link."""

from __future__ import annotations

import asyncio

from app.db import db, new_id, now
from app.jobs import store, worker


def _course(title: str) -> str:
    cid = new_id()
    with db() as conn:
        conn.execute(
            "INSERT INTO courses(id, title, slug, topic, status, created_at) VALUES (?,?,?,?,?,?)",
            (cid, title, cid, title, "building", now()),
        )
    return cid


def _job(kind: str, input: dict, course_id: str | None = None) -> dict:
    jid = store.enqueue(kind, input, course_id)
    with db() as conn:
        return dict(store.get_job(conn, jid))


def _notices_for(job_id: str) -> list[dict]:
    with db() as conn:
        return [dict(r) for r in conn.execute("SELECT * FROM notifications WHERE job_id=?", (job_id,))]


def _run(monkeypatch, job: dict, outcome) -> None:
    async def handler(_job):
        if isinstance(outcome, BaseException):
            raise outcome
        return {}

    monkeypatch.setattr(worker, "_handlers", lambda: {job["kind"]: handler})
    asyncio.run(worker.run_job(job))


def test_finished_build_notifies_once(client, monkeypatch):
    cid = _course("Rust ownership")
    job = _job("build_course", {}, cid)
    _run(monkeypatch, job, None)
    _run(monkeypatch, job, None)  # a re-claimed job finishing again must not notify twice
    (n,) = _notices_for(job["id"])
    assert n["kind"] == "course_ready" and n["title"] == "Rust ownership is ready"
    assert n["href"] == f"/courses/{cid}" and n["read_at"] is None


def test_failed_build_notifies_with_reason_and_cancel_is_silent(client, monkeypatch):
    cid = _course("Postgres query engine")
    failed = _job("build_course", {}, cid)
    _run(monkeypatch, failed, RuntimeError("model returned no structured output"))
    (n,) = _notices_for(failed["id"])
    assert n["kind"] == "course_failed" and n["title"] == "Build failed: Postgres query engine"
    assert n["body"] == "model returned no structured output"
    assert n["href"] == f"/courses/{cid}/building"

    cancelled = _job("build_course", {}, _course("Cancelled course"))
    _run(monkeypatch, cancelled, store.Cancelled())
    assert _notices_for(cancelled["id"]) == []


def test_review_notifies_with_project_link(client, course, monkeypatch):
    with db() as conn:
        project_id = conn.execute("SELECT id FROM projects WHERE course_id=? LIMIT 1", (course["id"],)).fetchone()[0]
    sid = new_id()
    job = _job("review_project", {"submissionId": sid})
    with db() as conn:
        conn.execute(
            "INSERT INTO submissions(id, project_id, repo_url, status, job_id, created_at) VALUES (?,?,?,?,?,?)",
            (sid, project_id, "https://github.com/a/b", "queued", job["id"], now()),
        )
    _run(monkeypatch, job, None)
    (n,) = _notices_for(job["id"])
    assert n["kind"] == "review_ready" and n["title"].startswith("Review ready: ")
    assert n["href"] == f"/courses/{course['id']}/projects/{project_id}"


def test_only_a_failed_added_link_notifies(client, monkeypatch):
    sid = new_id()
    with db() as conn:
        conn.execute(
            "INSERT INTO sources(id, kind, title, uri, status, updated_at) VALUES (?,?,?,?,?,?)",
            (sid, "url", "", "https://raft.github.io/raft.pdf", "pending", now()),
        )
    failed = _job("ingest", {"sourceIds": [sid]})
    _run(monkeypatch, failed, RuntimeError(f"{sid}: HTTP 404"))
    (n,) = _notices_for(failed["id"])
    assert n["kind"] == "source_failed" and n["href"] == "/sources"
    assert n["title"] == "Couldn’t index raft.github.io/raft.pdf" and n["body"] == "HTTP 404"

    ok_job = _job("ingest", {"sourceIds": [sid]})
    _run(monkeypatch, ok_job, None)
    note_job = _job("ingest", {"noteId": new_id()})
    _run(monkeypatch, note_job, RuntimeError("boom"))
    assert _notices_for(ok_job["id"]) == [] and _notices_for(note_job["id"]) == []


def test_notification_endpoints(client, monkeypatch):
    job = _job("build_course", {}, _course("Endpoint course"))
    _run(monkeypatch, job, None)
    items = client.get("/api/notifications").json()["data"]
    mine = next(n for n in items if n["title"] == "Endpoint course is ready")
    assert mine["read"] is False and set(mine) == {"id", "kind", "title", "body", "href", "courseId", "read", "createdAt"}
    assert items == sorted(items, key=lambda n: n["createdAt"], reverse=True)

    marked = client.patch(f"/api/notifications/{mine['id']}", json={"read": True}).json()["data"]
    assert marked["read"] is True
    assert client.patch("/api/notifications/nope", json={"read": True}).status_code == 404

    _run(monkeypatch, _job("build_course", {}, _course("Another course")), None)
    assert client.post("/api/notifications/mark-all-read").json()["data"]["updated"] >= 1
    assert all(n["read"] for n in client.get("/api/notifications").json()["data"])

