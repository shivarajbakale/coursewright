"""The outline review: the plan endpoints, the outline_ready notice, and writing after approval."""

from __future__ import annotations

import asyncio

import pytest

from app.db import db
from app.jobs import build_course, worker
from tests.test_notifications import _job
from tests.test_pipeline import _build, _status, fake  # noqa: F401 - fixture

pytestmark = pytest.mark.usefixtures("client")


def _paused(client, title="Reviewed course"):
    cid, job = _build({"topic": "Bloom filters", "reviewOutline": True}, title)
    asyncio.run(worker.run_job(job))  # through the worker, so the notice is written
    return cid, job


def test_creating_a_course_asks_to_review_the_outline_by_default(client):
    res = client.post("/api/courses", json={"brief": {"topic": "Tries"}})
    cid = res.json()["data"]["course"]["id"]
    with db() as conn:
        j = conn.execute("SELECT input FROM jobs WHERE course_id=?", (cid,)).fetchone()
    assert '"reviewOutline": true' in j["input"]
    off = client.post("/api/courses", json={"brief": {"topic": "Heaps", "reviewOutline": False}})
    with db() as conn:
        j = conn.execute("SELECT input FROM jobs WHERE course_id=?", (off.json()["data"]["course"]["id"],)).fetchone()
    assert '"reviewOutline": false' in j["input"]
    for c in (cid, off.json()["data"]["course"]["id"]):
        client.delete(f"/api/courses/{c}")


def test_paused_build_shows_its_outline_and_notifies(client, fake):  # noqa: F811
    cid, job = _paused(client)
    summary = next(c for c in client.get("/api/courses").json()["data"] if c["id"] == cid)
    assert summary["status"] == "planning" and summary["outlineReady"] is True
    plan = client.get(f"/api/courses/{cid}/plan").json()["data"]
    assert [m["title"] for m in plan["outline"]["modules"]] == ["Foundations", "Using it well"]
    assert plan["outline"]["modules"][0]["chapters"][0]["summary"] == "Items to numbers"
    assert plan["approvedAt"] is None and plan["estimate"]["tokens"] > 0 and plan["messages"] == []
    notes = [n for n in client.get("/api/notifications").json()["data"] if n["courseId"] == cid]
    assert notes[0]["kind"] == "outline_ready" and notes[0]["href"] == f"/courses/{cid}/building"


def test_chat_reshapes_the_outline_and_marks_what_changed(client, fake):  # noqa: F811
    cid, _ = _paused(client, "Chatted course")
    res = client.post(f"/api/courses/{cid}/plan/chat", json={"message": "add a chapter on deletes"})
    data = res.json()["data"]
    assert res.status_code == 200 and data["changed"] == ["c04-deletes"]
    assert data["reply"].startswith("Added 2.2")
    assert [m["role"] for m in data["messages"]] == ["user", "agent"]
    again = client.get(f"/api/courses/{cid}/plan").json()["data"]
    assert len(again["outline"]["modules"][1]["chapters"]) == 2  # saved


def test_chat_failure_leaves_the_outline_alone(client, fake, monkeypatch):  # noqa: F811
    from app.agents import llm

    cid, _ = _paused(client, "Failing chat")

    async def boom(**_):
        raise RuntimeError("provider down")

    monkeypatch.setattr(llm, "parse", boom)
    res = client.post(f"/api/courses/{cid}/plan/chat", json={"message": "add one"})
    assert res.status_code == 502 and "unchanged" in res.json()["message"]
    assert client.get(f"/api/courses/{cid}/plan").json()["data"]["messages"] == []


def test_remove_drops_a_chapter_without_a_model_call(client, fake):  # noqa: F811
    cid, _ = _paused(client, "Trimmed course")
    calls = len(fake.calls)
    res = client.post(f"/api/courses/{cid}/plan/remove", json={"chapterKey": "c02-bits"})
    outline = res.json()["data"]["outline"]
    assert [ch["key"] for ch in outline["modules"][0]["chapters"]] == ["c01-hashing"]
    assert "b" not in {c["key"] for c in outline["concepts"]}  # nothing teaches it any more
    assert len(fake.calls) == calls
    # The last chapter of a module stays; a missing one is a 404.
    assert client.post(f"/api/courses/{cid}/plan/remove", json={"chapterKey": "c01-hashing"}).status_code == 409
    assert client.post(f"/api/courses/{cid}/plan/remove", json={"chapterKey": "nope"}).status_code == 404


def test_approve_writes_the_course_from_the_agreed_outline(client, fake):  # noqa: F811
    cid, _ = _paused(client, "Approved course")
    client.post(f"/api/courses/{cid}/plan/remove", json={"chapterKey": "c02-bits"})
    res = client.post(f"/api/courses/{cid}/plan/approve")
    data = res.json()["data"]
    assert res.status_code == 200 and data["course"]["status"] == "building" and not data["course"]["outlineReady"]
    assert client.post(f"/api/courses/{cid}/plan/approve").status_code == 409
    assert client.post(f"/api/courses/{cid}/plan/chat", json={"message": "x"}).status_code == 409

    with db() as conn:
        job = dict(conn.execute("SELECT * FROM jobs WHERE id=?", (data["jobId"],)).fetchone())
    asyncio.run(build_course.run(job))
    assert _status(cid) == "ready"
    course = client.get(f"/api/courses/{cid}").json()["data"]
    titles = [ch["title"] for m in course["modules"] for ch in m["chapters"]]
    assert titles == ["Hashing from scratch", "Choosing the size"]  # c02 stayed removed
    assert fake.calls.count("ResearchOut") == 1  # the writing job reused the plan's research


def test_plan_404s(client):
    assert client.get("/api/courses/nope/plan").status_code == 404
    cid = _job("build_course", {})["id"]  # a job, not a course
    assert client.get(f"/api/courses/{cid}/plan").status_code == 404


def test_chat_reply_states_the_real_chapter_count(client, fake, monkeypatch):  # noqa: F811
    """A model that says "14 chapters" over a longer outline is corrected by code, not believed."""
    from app.agents import llm
    from app.jobs import pipeline
    from app.materialise import CourseOutline
    from tests.test_pipeline import outline_data

    cid, _ = _paused(client, "Long course")
    data = outline_data()
    data["modules"][1]["chapters"] = [
        {"key": f"x{i:02d}", "title": f"Extra {i}", "summary": "", "conceptKeys": ["c"]} for i in range(13)
    ]

    async def long(**_):
        return pipeline.OutlineChatOut(outline=CourseOutline.model_validate(data), reply="Done, 14 chapters."), {}

    monkeypatch.setattr(llm, "parse", long)
    reply = client.post(f"/api/courses/{cid}/plan/chat", json={"message": "add more"}).json()["data"]["reply"]
    assert "15 chapters, over the limit of 14" in reply
