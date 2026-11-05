from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path

import pytest

from app.db import connect, rows
from app.materialise import MaterialiseError, materialise, parse_course_folder
from tests.conftest import FIXTURES


def _events(body: str) -> list[dict]:
    return [json.loads(line[6:]) for line in body.splitlines() if line.startswith("data: ")]


def test_sse_replays_and_closes(client):
    from app.jobs import store

    jid = store.enqueue("ingest", {})
    store.emit(jid, "index", "one", {"chunks": 1})
    store.emit(jid, "index", "two", {"chunks": 2})
    store.emit(jid, "done", "finished", {})
    store.finish(jid, "done")

    with client.stream("GET", f"/api/jobs/{jid}/events") as r:
        assert r.headers["content-type"].startswith("text/event-stream")
        evs = _events("".join(r.iter_text()))
    assert [e["seq"] for e in evs] == [1, 2, 3]
    assert set(evs[0]) == {"id", "seq", "stage", "message", "payload", "at"}
    assert evs[0]["payload"] == {"chunks": 1} and evs[-1]["stage"] == "done"

    with client.stream("GET", f"/api/jobs/{jid}/events", params={"after": 2}) as r:
        evs = _events("".join(r.iter_text()))
    assert [e["seq"] for e in evs] == [3]


def test_sse_closes_on_failed_job(client):
    from app.jobs import store

    jid = store.enqueue("ingest", {})
    store.emit(jid, "research", "boom", {"error": "x"})
    store.finish(jid, "failed", error="x")
    with client.stream("GET", f"/api/jobs/{jid}/events") as r:
        evs = _events("".join(r.iter_text()))
    assert len(evs) == 1


def test_interview_fallback(client):
    answers = []
    seen = []
    for _ in range(10):
        step = client.post("/api/interview/next", json={"topic": "Rust ownership", "answers": answers}).json()["data"]
        assert {"question", "done", "summary"} <= set(step)
        if step["done"]:
            break
        q = step["question"]
        assert set(q) == {"id", "header", "question", "multiSelect", "options"}
        assert 2 <= len(q["options"]) <= 4
        assert sum(1 for o in q["options"] if o["recommended"]) == 1
        assert all(set(o) == {"label", "description", "recommended"} for o in q["options"])
        seen.append(q["id"])
        answers.append({"question": q["question"], "answer": [q["options"][0]["label"]]})
    assert seen == ["level", "goal", "pace", "projects"]
    assert step["done"] and step["question"] is None and "Rust ownership" in step["summary"]


def test_materialise_fixture(client, tmp_path):
    parsed = parse_course_folder(FIXTURES / "course_min")
    assert parsed.outline.title == "Hash tables in practice"
    conn = connect()
    try:
        cid = materialise(conn, FIXTURES / "course_min")
        chs = rows(conn, "SELECT * FROM chapters WHERE course_id=? ORDER BY position", (cid,))
        assert [c["title"] for c in chs] == ["Hash functions", "Handling collisions"]
        assert rows(conn, "SELECT COUNT(*) FROM questions WHERE chapter_id=?", (chs[0]["id"],))[0][0] == 1
        assert rows(conn, "SELECT kind FROM diagrams WHERE chapter_id=?", (chs[0]["id"],))[0][0] == "mermaid"
        proj = rows(conn, "SELECT rubric FROM projects WHERE course_id=?", (cid,))[0]
        rubric = json.loads(proj["rubric"])
        assert rubric[0]["chapterId"] == chs[1]["id"] and rubric[1]["chapterId"] is None
        assert rows(conn, "SELECT COUNT(*) FROM concept_edges e JOIN concepts c ON c.id=e.from_id WHERE c.course_id=?", (cid,))[0][0] == 1
    finally:
        conn.close()
    detail = client.get(f"/api/courses/{cid}").json()["data"]
    assert detail["status"] == "ready" and detail["projectCount"] == 1
    client.delete(f"/api/courses/{cid}")

    # A missing chapter file or a dangling key is rejected before anything is written.
    broken = tmp_path / "broken"
    shutil.copytree(FIXTURES / "course_min", broken)
    (broken / "chapters" / "c02-collisions.md").unlink()
    with pytest.raises(MaterialiseError, match="c02-collisions.md"):
        parse_course_folder(broken)
    outline = json.loads((FIXTURES / "course_min" / "outline.json").read_text())
    outline["edges"].append({"from": "hashing", "to": "ghost"})
    shutil.copy(FIXTURES / "course_min" / "chapters" / "c01-hashing.md", broken / "chapters" / "c02-collisions.md")
    (broken / "outline.json").write_text(json.dumps(outline))
    with pytest.raises(MaterialiseError, match="unknown concept"):
        parse_course_folder(broken)


def test_chunker_keeps_code_fences():
    from app.rag.chunk import chunk_markdown

    code = "```go\n" + "\n".join(f"x{i} := {i}" for i in range(400)) + "\n```"
    md = "# T\n\n## Section\n\n" + ("para " * 200 + "\n\n") * 10 + code + "\n\n" + "tail " * 50
    chunks = chunk_markdown(md)
    assert len(chunks) > 1
    for c in chunks:
        assert c.text.count("```") % 2 == 0
    assert all(c.anchor == "section" for c in chunks)


def test_local_embedder_is_deterministic():
    from app.rag.embed import local_embed

    a, b = local_embed("leader election timeout"), local_embed("leader election timeout")
    assert a == b and len(a) == 1024
    assert abs(sum(x * x for x in a) - 1.0) < 1e-6


def test_progress_maps_files_to_events(client, tmp_path):
    from app.jobs import store
    from app.jobs.build_course import Progress

    jid = store.enqueue("build_course", {})
    shutil.copytree(FIXTURES / "course_min", tmp_path / "course")
    (tmp_path / "research").mkdir()
    (tmp_path / "research" / "refs.json").write_text(json.dumps({"terms": ["hashing"], "refs": []}))
    p = Progress(jid, tmp_path)
    p.scan()
    p.scan()  # idempotent
    conn = connect()
    try:
        evs = rows(conn, "SELECT stage, payload FROM job_events WHERE job_id=? ORDER BY seq", (jid,))
    finally:
        conn.close()
    stages = [e["stage"] for e in evs]
    assert stages == ["research", "concepts", "outline", "chapters", "chapters", "projects"]
    assert json.loads(evs[3]["payload"]) == {"chapter": "Hash functions", "done": 1, "total": 2}
    store.request_cancel(jid)


def test_tutor_context_extraction():
    from types import SimpleNamespace

    from app.agents.tutor import frontend_context

    rt = SimpleNamespace(
        state={
            "copilotkit": {
                "context": [
                    {"description": "courseId", "value": "c1"},
                    {"description": "Current chapter", "value": json.dumps({"chapterId": "ch1", "selection": "votes"})},
                ]
            }
        },
        context=None,
    )
    assert frontend_context(rt) == {"courseId": "c1", "chapterId": "ch1", "selection": "votes"}


def test_tutor_search_tool(client, course):
    from types import SimpleNamespace

    from app.agents.tutor import search_course

    rt = SimpleNamespace(state={"copilotkit": {"context": [{"description": "courseId", "value": course["id"]}]}}, context=None)
    out = asyncio.run(search_course.coroutine("randomized election timeout", "course", rt))
    assert out.startswith("[1]") and "chunkId=" in out
