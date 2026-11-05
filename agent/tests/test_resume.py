"""Continue: a stopped build is re-queued as the same job, so it resumes from its checkpoint and files."""

from __future__ import annotations

from app.db import db, now
from app.jobs import store
from tests.test_notifications import _course, _job


def _fail(job_id: str, course_id: str) -> None:
    store.finish(job_id, "failed", error="Token budget exceeded")
    with db() as conn:
        conn.execute("UPDATE courses SET status='failed', job_id=? WHERE id=?", (job_id, course_id))
        conn.execute(
            "INSERT INTO notifications(id, kind, title, body, href, course_id, job_id, created_at)"
            " VALUES (?,?,?,?,?,?,?,?)",
            (job_id + "-n", "course_failed", "Build failed: X", "", "/", course_id, job_id, now()),
        )


def test_continue_requeues_the_same_job(client):
    cid = _course("Transformers from scratch")
    job = _job("build_course", {}, cid)
    _fail(job["id"], cid)

    res = client.post(f"/api/courses/{cid}/resume")
    assert res.status_code == 200 and res.json()["data"]["jobId"] == job["id"]
    assert res.json()["data"]["course"]["status"] == "building"
    with db() as conn:
        j = store.get_job(conn, job["id"])
        assert j["status"] == "queued" and j["error"] is None and j["attempts"] == 0
        assert conn.execute("SELECT COUNT(*) FROM notifications WHERE job_id=?", (job["id"],)).fetchone()[0] == 0
        last = conn.execute("SELECT message FROM job_events WHERE job_id=? ORDER BY seq DESC", (job["id"],)).fetchone()
        assert last["message"] == "Continuing the build where it stopped"

    # Now queued: a second Continue is refused rather than queuing twice.
    assert client.post(f"/api/courses/{cid}/resume").status_code == 409


def test_continue_refuses_what_it_cannot_continue(client, course):
    assert client.post(f"/api/courses/{course['id']}/resume").status_code == 409  # ready, seeded
    assert client.post("/api/courses/nope/resume").status_code == 404
