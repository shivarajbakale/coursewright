"""Every contract route returns the contract shape for the seeded data."""

from __future__ import annotations

from tests.conftest import drain

SUMMARY = {
    "id", "title", "topic", "status", "colour", "icon", "createdAt", "moduleCount", "chapterCount",
    "projectCount", "chaptersDone", "jobId", "lastOpenedChapterId", "outlineReady",
}
DETAIL = SUMMARY | {"brief", "summary", "modules", "concepts", "edges", "weakSpots"}
CHAPTER = {
    "id", "courseId", "courseTitle", "moduleId", "moduleTitle", "position", "title", "markdown", "readingMinutes",
    "questions", "diagrams", "prev", "next", "startedAt", "finishedAt",
}
QUESTION = {"id", "prompt", "options", "answer", "explanation", "conceptIds", "lastAttempt"}
PROJECT = {
    "id", "courseId", "courseTitle", "moduleId", "moduleTitle", "title", "brief", "starter", "hints", "rubric",
    "milestones", "submissions",
}
MILESTONE = {"id", "position", "title", "body", "checkCmd", "doneAt"}
NOTE_SUMMARY = {"id", "parentId", "position", "title", "icon", "courseId", "chapterId", "updatedAt"}
NOTE_PAGE = NOTE_SUMMARY | {"cover", "properties", "markdown", "backlinks"}
SOURCE = {"id", "kind", "title", "uri", "courseId", "status", "chunkCount", "error", "updatedAt"}
HIT = {"chunkId", "sourceId", "title", "text", "context", "score", "courseId", "chapterId", "anchor"}
JOB = {"id", "kind", "status", "courseId", "error", "createdAt", "usage"}


def data(resp, status=200):
    assert resp.status_code == status, resp.text
    body = resp.json()
    assert set(body) == {"data"}
    return body["data"]


def test_health(client):
    h = data(client.get("/api/health"))
    assert h == {"ok": True, "anthropic": False, "voyage": False, "version": h["version"], "model": "claude-opus-5-5", "provider": "anthropic"}


def test_courses(client, course):
    lst = data(client.get("/api/courses"))
    assert all(set(c) == SUMMARY for c in lst)
    assert set(course) == DETAIL
    assert set(course["brief"]) >= {"topic", "answers"}
    m = course["modules"][0]
    assert set(m) == {"id", "position", "title", "summary", "chapters", "project"}
    assert set(m["chapters"][0]) == {"id", "position", "title", "readingMinutes", "done"}
    assert set(m["project"]) == {"id", "title", "milestonesDone", "milestonesTotal"}
    assert set(course["concepts"][0]) == {"id", "name", "summary"}
    assert set(course["edges"][0]) == {"from", "to"}
    assert set(course["weakSpots"][0]) == {"conceptId", "name", "wrong"}


def test_404_shape(client):
    r = client.get("/api/courses/nope")
    assert r.status_code == 404 and r.json() == {"message": "Course not found"}


def test_chapter_progress_attempts(client, course):
    first = course["modules"][0]["chapters"][0]
    ch = data(client.get(f"/api/chapters/{first['id']}"))
    assert set(ch) == CHAPTER
    assert ch["prev"] is None and set(ch["next"]) == {"id", "title"}
    assert ch["questions"] and set(ch["questions"][0]) == QUESTION
    assert "> **Key idea:**" in ch["markdown"]

    diagrams = [d for m in course["modules"] for c in m["chapters"] for d in data(client.get(f"/api/chapters/{c['id']}"))["diagrams"]]
    assert {d["kind"] for d in diagrams} == {"mermaid", "flow"}
    assert set(diagrams[0]) == {"id", "kind", "title", "source"}

    p = data(client.post(f"/api/chapters/{first['id']}/progress", json={"finished": True}))
    assert set(p) == {"startedAt", "finishedAt"} and p["finishedAt"]

    q = ch["questions"][0]
    a = data(client.post(f"/api/questions/{q['id']}/attempts", json={"chosen": q["answer"]}))
    assert a == {"correct": True, "answer": q["answer"], "explanation": q["explanation"]}
    ch2 = data(client.get(f"/api/chapters/{first['id']}"))
    assert ch2["questions"][0]["lastAttempt"] == {"chosen": q["answer"], "correct": True}


def test_project_milestone_submission(client, course):
    pid = course["modules"][0]["project"]["id"]
    p = data(client.get(f"/api/projects/{pid}"))
    assert set(p) == PROJECT
    assert set(p["milestones"][0]) == MILESTONE
    assert set(p["starter"][0]) == {"path", "note"}
    assert set(p["rubric"][0]) == {"criterion", "chapterId"}
    ms = data(client.patch(f"/api/milestones/{p['milestones'][0]['id']}", json={"done": True}))
    assert set(ms) == MILESTONE and ms["doneAt"]
    # Reviews need Claude: 503 without a key.
    r = client.post(f"/api/projects/{pid}/submissions", json={"repoUrl": "https://github.com/a/b"})
    assert r.status_code == 503 and r.json() == {"message": "ANTHROPIC_API_KEY is not set"}
    assert client.get("/api/submissions/missing").status_code == 404


def test_notes_crud(client, course):
    tree = data(client.get("/api/notes/tree"))
    assert len(tree) >= 4 and all(set(n) == NOTE_SUMMARY for n in tree)
    assert any(n["parentId"] for n in tree) and any(n["chapterId"] for n in tree)
    assert len(data(client.get("/api/notes/recent"))) <= 8
    hits = data(client.get("/api/notes/search", params={"q": "election"}))
    assert hits and set(hits[0]) == {"id", "title", "icon", "snippet"}

    cheat = next(n for n in tree if n["title"] == "Leader election cheatsheet")
    page = data(client.get(f"/api/notes/{cheat['id']}"))
    assert set(page) == NOTE_PAGE
    assert any(b["title"] == "Raft study notes" for b in page["backlinks"])

    new = data(client.post("/api/notes", json={"parentId": cheat["id"], "title": "Scratch", "markdown": "hello"}), 201)
    assert set(new) == NOTE_PAGE and new["parentId"] == cheat["id"]
    upd = data(client.patch(f"/api/notes/{new['id']}", json={"title": "Scratch 2", "properties": {"status": "Draft"}}))
    assert upd["title"] == "Scratch 2" and upd["properties"] == {"status": "Draft"} and upd["markdown"] == "hello"
    child = data(client.post("/api/notes", json={"parentId": new["id"], "title": "Child"}), 201)
    assert client.patch(f"/api/notes/{new['id']}", json={"parentId": child["id"]}).status_code == 422
    assert data(client.delete(f"/api/notes/{new['id']}")) == {"ok": True}
    assert client.get(f"/api/notes/{child['id']}").status_code == 404  # children deleted too
    drain()


def test_note_patch_reindexes(client):
    tree = data(client.get("/api/notes/tree"))
    reading = next(n for n in tree if n["title"] == "Reading list")
    data(client.patch(f"/api/notes/{reading['id']}", json={"markdown": "Zanzibar quorum papers to read"}))
    drain()
    hits = data(client.post("/api/search/test", json={"query": "Zanzibar quorum papers"}))
    assert any("Zanzibar" in h["text"] for h in hits)


def test_sources_and_search(client, course):
    srcs = data(client.get("/api/sources"))
    assert srcs and all(set(s) == SOURCE for s in srcs)
    assert all(s["status"] == "indexed" for s in srcs if s["kind"] in ("chapter", "note"))
    stats = data(client.get("/api/sources/stats"))
    assert set(stats) == {"sources", "chunks", "courses", "embedModel", "dims", "embedder"}
    assert stats["embedder"] == "local" and stats["dims"] == 1024 and stats["chunks"] > 0

    hits = data(client.post("/api/search/test", json={"query": "leader election", "courseId": course["id"], "k": 5}))
    assert 1 <= len(hits) <= 5 and all(set(h) == HIT for h in hits)
    assert all(h["courseId"] == course["id"] for h in hits)
    titles = " ".join(h["title"] + h["text"] for h in hits).lower()
    assert "election" in titles


def test_add_url_source_and_reindex(client):
    s = data(client.post("/api/sources", json={"kind": "url", "uri": "https://example.com/raft"}), 201)
    assert set(s) == SOURCE and s["status"] == "pending"
    job = data(client.post("/api/sources/reindex"))
    assert set(job) == {"jobId"}
    j = data(client.get(f"/api/jobs/{job['jobId']}"))
    assert set(j) == JOB and j["kind"] == "reindex"
    # No network in tests: drop the queued url ingest + reindex and the url source.
    from app.db import connect
    from app.rag.ingest import delete_source

    conn = connect()
    try:
        for (jid,) in conn.execute("SELECT id FROM jobs WHERE status='queued'").fetchall():
            data(client.post(f"/api/jobs/{jid}/cancel"))
        delete_source(conn, s["id"])
    finally:
        conn.close()


def test_create_course_without_key_fails_cleanly(client):
    out = data(client.post("/api/courses", json={"brief": {"topic": "Rust ownership", "answers": []}}), 201)
    assert set(out) == {"course", "jobId"} and set(out["course"]) == SUMMARY
    assert out["course"]["status"] == "planning" and out["course"]["jobId"] == out["jobId"]
    drain()
    job = data(client.get(f"/api/jobs/{out['jobId']}"))
    assert job["status"] == "failed" and "ANTHROPIC_API_KEY" in job["error"]
    c = data(client.get(f"/api/courses/{out['course']['id']}"))
    assert c["status"] == "failed"
    with client.stream("GET", f"/api/jobs/{out['jobId']}/events") as r:
        body = "".join(r.iter_text())
    assert "ANTHROPIC_API_KEY" in body
    assert data(client.delete(f"/api/courses/{out['course']['id']}")) == {"ok": True}


def test_cancel_queued_job(client):
    from app.jobs import store

    jid = store.enqueue("ingest", {"sourceIds": []})
    j = data(client.post(f"/api/jobs/{jid}/cancel"))
    assert j["status"] == "cancelled"


def test_tutor_endpoint_without_key(client):
    r = client.post("/agents/tutor", json={})
    assert r.status_code == 503 and r.json() == {"message": "ANTHROPIC_API_KEY is not set"}
