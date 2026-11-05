"""Flowmovie check, diagrammer fallback, diagram materialise, job re-claim + resume, shared-secret auth, and the
tutor tools' JSON shapes. No keys, no network: the model is a fake chat model or a monkeypatched parse."""

from __future__ import annotations

import asyncio
import json
import shutil
from datetime import datetime, timedelta, timezone

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app import flowmovie
from app.agents import diagrammer
from app.db import connect, new_id, now, row, rows
from app.materialise import materialise, parse_course_folder

from .conftest import FIXTURES

needs_node = pytest.mark.skipif(flowmovie.node_bin() is None, reason="node is not installed")

GOOD_FLOW = """title The TCP three-way handshake

client "Client" state closed
server "Server" state listen

# Before anything is sent, the server is listening and the client is closed.
pause "A connection needs both sides to agree on starting sequence numbers."

# The client opens with SYN and its own sequence number.
new syn at client
client : "syn-sent"
syn -> server  "SYN, seq = x"
remove syn

# The client and server are connected.
together
  client : established
  server : established
"""

BAD_FLOW = """title Broken

a "A"
t at a

# The token goes somewhere that doesn't exist.
t -> ghost
"""

GOOD_MERMAID = "%% title: Lookup\nsequenceDiagram\n  Client->>Server: SYN\n  Server->>Client: SYN-ACK\n"


def fenced(src: str, lang: str = "flow") -> str:
    return f"Here it is.\n\n```{lang}\n{src}```\n"


# ---- flow_check / flow_story ----------------------------------------------------------------------


@needs_node
def test_flow_check_good_and_bad_movies():
    good = flowmovie.check(GOOD_FLOW)
    assert good["ok"] is True and good["errors"] == []
    assert "scene" in good["summary"]

    bad = flowmovie.check(BAD_FLOW)
    assert bad["ok"] is False
    assert bad["errors"] and bad["errors"][0]["line"] == 7
    assert "ghost" in bad["errors"][0]["message"]

    # The tool form, as the diagrammer sees it.
    assert asyncio.run(diagrammer.flow_check.ainvoke({"source": GOOD_FLOW})).startswith("OK: ")
    out = asyncio.run(diagrammer.flow_check.ainvoke({"source": BAD_FLOW}))
    assert out.startswith("FAILED") and "line 7: error" in out


@needs_node
def test_flow_check_seed_movie_and_story():
    seed = json.loads((diagrammer.config.APP_DIR / "seed/raft/chapters/c04-elections-and-timeouts.json").read_text())
    src = next(d["source"] for d in seed["diagrams"] if d["kind"] == "flow")
    assert flowmovie.check(src)["ok"]
    story = flowmovie.story(GOOD_FLOW)
    assert "Scene 1" in story and "The TCP three-way handshake" in story


def test_flow_check_without_node(monkeypatch):
    monkeypatch.setattr(flowmovie, "node_bin", lambda: None)
    r = flowmovie.check(GOOD_FLOW)
    assert r["ok"] is False and "node is not installed" in r["errors"][0]["message"]


# ---- diagrammer fallback --------------------------------------------------------------------------


@needs_node
def test_save_diagram_enforces_check_and_mermaid_fallback(tmp_path):
    saver = diagrammer.DiagramSaver(tmp_path)
    for i in range(diagrammer.MAX_FLOW_ATTEMPTS):
        msg = saver.save("c01-x", "flow", "Broken", BAD_FLOW)
        assert msg.startswith("Not saved")
    assert "No attempts left" in msg
    assert not (tmp_path / "diagrams" / "c01-x.flow").exists()
    # A fourth movie is refused even if it would compile: only Mermaid now.
    assert saver.save("c01-x", "flow", "Handshake", GOOD_FLOW).startswith("Refused")
    assert saver.save("c01-x", "mermaid", "Lookup", "not a diagram").startswith("Not saved")
    assert saver.save("c01-x", "mermaid", "Handshake", GOOD_MERMAID).startswith("Saved")
    assert (tmp_path / "diagrams" / "c01-x.mmd").read_text().startswith("%% title: Lookup")
    # Another chapter: a good movie is saved, with a title line added when missing.
    body = GOOD_FLOW.split("\n", 2)[2]
    assert saver.save("c02-y", "flow", "Handshake", body).startswith("Saved")
    assert (tmp_path / "diagrams" / "c02-y.flow").read_text().startswith("title Handshake")
    assert saver.save("../evil", "mermaid", "x", GOOD_MERMAID).startswith("Refused")


@needs_node
def test_make_movie_retries_then_falls_back_to_mermaid():
    n = diagrammer.MAX_FLOW_ATTEMPTS
    model = FakeListChatModel(responses=[fenced(BAD_FLOW)] * n + [fenced(GOOD_MERMAID, "mermaid")])
    out = asyncio.run(diagrammer.make_movie("the TCP handshake", model=model))
    assert out["kind"] == "mermaid" and out["title"] == "Lookup"
    assert out["source"].startswith("%% title: Lookup") and out["attempts"] == n and len(out["errors"]) == n


@needs_node
def test_make_movie_fixes_on_second_try():
    model = FakeListChatModel(responses=[fenced(BAD_FLOW), fenced(GOOD_FLOW)])
    out = asyncio.run(diagrammer.make_movie("the TCP handshake", model=model))
    assert out["kind"] == "flow" and out["attempts"] == 2
    assert out["title"] == "The TCP three-way handshake" and flowmovie.check(out["source"])["ok"]


@needs_node
def test_make_flow_tool_shape(client, course, monkeypatch):
    from types import SimpleNamespace

    from app.agents import llm
    from app.agents.tutor import make_flow

    monkeypatch.setattr(llm, "chat_model", lambda *a, **k: FakeListChatModel(responses=[fenced(GOOD_FLOW)]))
    rt = SimpleNamespace(state={"copilotkit": {"context": [{"description": "courseId", "value": course["id"]}]}}, context=None)
    out = json.loads(asyncio.run(make_flow.coroutine("a leader election", rt)))
    assert set(out) == {"kind", "title", "source"}
    assert out["kind"] == "flow" and out["title"] == "The TCP three-way handshake"


# ---- materialise diagrams -------------------------------------------------------------------------


@needs_node
def test_materialise_loads_diagram_files(client, tmp_path):
    folder = tmp_path / "course"
    shutil.copytree(FIXTURES / "course_min", folder)
    side = json.loads((folder / "chapters" / "c01-hashing.json").read_text())
    side["diagramRequest"] = {"title": "How a lookup finds its bucket", "show": "key, hash, bucket", "shape": "structure"}
    (folder / "chapters" / "c01-hashing.json").write_text(json.dumps(side))
    (folder / "diagrams").mkdir()
    (folder / "diagrams" / "c01-hashing.mmd").write_text("%% title: Ignored\nflowchart LR\n  K --> B\n")
    (folder / "diagrams" / "c02-collisions.flow").write_text(GOOD_FLOW)
    (folder / "diagrams" / "c02-collisions.mmd").write_text(GOOD_MERMAID)  # .flow wins
    (folder / "diagrams" / "nope.flow").write_text(BAD_FLOW)  # not a chapter: ignored

    assert diagrammer.validate_course_diagrams(folder) == ["nope"]
    assert (folder / "diagrams" / "nope.flow.rejected").exists()

    parsed = parse_course_folder(folder)
    assert [d.kind for d in parsed.extras["c01-hashing"].diagrams] == ["mermaid", "mermaid"]
    conn = connect()
    try:
        cid = materialise(conn, folder)
        chs = rows(conn, "SELECT id FROM chapters WHERE course_id=? ORDER BY position", (cid,))
        d1 = rows(conn, "SELECT kind, title, source FROM diagrams WHERE chapter_id=? ORDER BY position", (chs[0]["id"],))
        d2 = rows(conn, "SELECT kind, title, source FROM diagrams WHERE chapter_id=?", (chs[1]["id"],))
    finally:
        conn.close()
    assert [(d["kind"], d["title"]) for d in d1] == [("mermaid", "Lookup"), ("mermaid", "How a lookup finds its bucket")]
    assert len(d2) == 1 and d2[0]["kind"] == "flow" and d2[0]["title"] == "The TCP three-way handshake"
    assert flowmovie.check(d2[0]["source"])["ok"]
    client.delete(f"/api/courses/{cid}")


# ---- job re-claim + resume ------------------------------------------------------------------------


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _running_job(conn, *, worker: str | None, beat: str | None, attempts: int = 1, cancel: int = 0) -> str:
    jid = new_id()
    conn.execute(
        """INSERT INTO jobs(id, kind, status, input, created_at, started_at, attempts, cancel_requested, worker_id, heartbeat_at)
           VALUES (?, 'ingest', 'running', '{}', ?, ?, ?, ?, ?, ?)""",
        (jid, now(), now(), attempts, cancel, worker, beat),
    )
    return jid


def test_reclaim_stale_running_jobs(client):
    from app.jobs import store

    old = _iso(datetime.now(timezone.utc) - timedelta(minutes=5))
    conn = connect()
    try:
        dead = _running_job(conn, worker="host:1:dead", beat=old)
        legacy = _running_job(conn, worker=None, beat=None)  # claimed before leases existed
        alive = _running_job(conn, worker="host:2:alive", beat=now())
        mine = _running_job(conn, worker=store.WORKER_ID, beat=old)
        worn = _running_job(conn, worker="host:1:dead", beat=old, attempts=store.MAX_ATTEMPTS)
        cancelled = _running_job(conn, worker="host:1:dead", beat=old, cancel=1)
    finally:
        conn.close()

    res = store.reclaim_stale()
    ids = {k: {j["id"] for j in v} for k, v in res.items()}
    assert {dead, legacy} <= ids["requeued"] and worn in ids["failed"] and cancelled in ids["cancelled"]
    assert alive not in set().union(*ids.values()) and mine not in set().union(*ids.values())

    conn = connect()
    try:
        status = {r["id"]: r for r in rows(conn, "SELECT id, status, worker_id, error FROM jobs WHERE id IN (?,?,?,?,?,?)",
                                             (dead, legacy, alive, mine, worn, cancelled))}
        assert status[dead]["status"] == "queued" and status[dead]["worker_id"] is None
        assert status[alive]["status"] == "running" and status[mine]["status"] == "running"
        assert status[worn]["status"] == "failed" and "Gave up" in status[worn]["error"]
        assert status[cancelled]["status"] == "cancelled"
        # Clean up so later drains don't pick these up.
        conn.execute("UPDATE jobs SET status='cancelled' WHERE id IN (?,?,?,?)", (dead, legacy, alive, mine))
    finally:
        conn.close()


def test_claim_leases_and_heartbeats(client):
    from app.jobs import store

    jid = store.enqueue("reindex", {})
    conn = connect()
    try:
        # Only this job is queued for the duration of the claim.
        others = [r["id"] for r in rows(conn, "SELECT id FROM jobs WHERE status='queued' AND id != ?", (jid,))]
        conn.executemany("UPDATE jobs SET status='cancelled' WHERE id=?", [(o,) for o in others])
    finally:
        conn.close()
    job = store.claim_next(worker_id="w-test")
    assert job["id"] == jid and job["worker_id"] == "w-test" and job["heartbeat_at"]
    store.heartbeat([jid], worker_id="w-test")
    assert store.reclaim_stale(worker_id="w-other")["requeued"] == []  # fresh heartbeat: still alive
    store.finish(jid, "cancelled")


def test_build_thread_resumes_from_checkpoint(client):
    """The builder streams with input None when its thread (thread_id = job id) already has a checkpoint."""
    from typing import TypedDict

    from langgraph.graph import END, START, StateGraph

    from app.agents import checkpoint

    class S(TypedDict):
        n: int

    async def go():
        async with checkpoint.saver() as cp:
            g = StateGraph(S)
            g.add_node("inc", lambda s: {"n": s["n"] + 1})
            g.add_edge(START, "inc")
            g.add_edge("inc", END)
            graph = g.compile(checkpointer=cp)
            job_id = new_id()
            assert not await checkpoint.has_checkpoint(cp, job_id)
            await graph.ainvoke({"n": 1}, {"configurable": {"thread_id": job_id}})
            assert await checkpoint.has_checkpoint(cp, job_id)
            # Resuming a finished thread with None is a no-op that keeps its state.
            out = await graph.ainvoke(None, {"configurable": {"thread_id": job_id}})
            return out

    assert asyncio.run(go()) == {"n": 2}


# ---- shared-secret auth ---------------------------------------------------------------------------


def test_shared_secret(client, monkeypatch):
    monkeypatch.setenv("CW_SHARED_SECRET", "s3cret")
    assert client.get("/api/health").status_code == 200
    r = client.get("/api/courses")
    assert r.status_code == 401 and r.json() == {"message": "Missing or wrong x-cw-secret header"}
    assert client.get("/api/courses", headers={"x-cw-secret": "nope"}).status_code == 401
    assert client.get("/api/courses", headers={"x-cw-secret": "s3cret"}).status_code == 200
    assert client.post("/agents/tutor", json={}).status_code == 401
    assert client.post("/agents/tutor", json={}, headers={"x-cw-secret": "s3cret"}).status_code == 503  # no key
    monkeypatch.delenv("CW_SHARED_SECRET")
    assert client.get("/api/courses").status_code == 200


# ---- tutor tools ----------------------------------------------------------------------------------


def test_make_quiz_shape(client, course, monkeypatch):
    from types import SimpleNamespace

    from app.agents import llm
    from app.agents.tutor import QuizDraft, make_quiz

    chapter_id = course["modules"][1]["chapters"][0]["id"]
    seen = {}

    async def fake_parse(*, system, user, schema, effort="low", max_tokens=4000):
        seen["user"] = user
        assert schema is QuizDraft
        return QuizDraft.model_validate(
            {
                "questions": [
                    {"prompt": "Why randomize timeouts?", "options": ["Avoid split votes", "Save power", "Order logs"],
                     "answer": 0, "explanation": "Staggered timers mean one server usually times out first.", "passage": 1},
                    {"prompt": "Dupes", "options": ["A", "a"], "answer": 0, "explanation": "", "passage": 1},
                    {"prompt": "Out of range", "options": ["A", "B"], "answer": 5, "explanation": "", "passage": 1},
                    {"prompt": "Majority of five?", "options": ["2", "3", "4"], "answer": 1,
                     "explanation": "Three of five is a majority.", "passage": 99},
                ]
            }
        ), {"inputTokens": 1, "outputTokens": 1}

    monkeypatch.setattr(llm, "parse", fake_parse)
    rt = SimpleNamespace(state={"copilotkit": {"context": [{"description": "courseId", "value": course["id"]}]}}, context=None)

    out = json.loads(asyncio.run(make_quiz.coroutine(chapter_id, 3, rt)))
    assert list(out) == ["questions"] and len(out["questions"]) == 2
    for q in out["questions"]:
        assert set(q) == {"prompt", "options", "answer", "explanation", "chapterId"}
        assert 0 <= q["answer"] < len(q["options"]) and len(set(q["options"])) == len(q["options"])
        assert q["chapterId"] == chapter_id
    assert "[1]" in seen["user"]

    out = json.loads(asyncio.run(make_quiz.coroutine("randomized election timeout", 1, rt)))
    assert len(out["questions"]) == 1
    conn = connect()
    try:
        assert row(conn, "SELECT course_id FROM chapters WHERE id=?", (out["questions"][0]["chapterId"],))[0] == course["id"]
    finally:
        conn.close()


def test_web_search_only_when_context_says_so():
    from types import SimpleNamespace

    from app.agents.tutor import WEB_SEARCH_TOOL, WebSearchToggle, web_search_enabled

    on = {"copilotkit": {"context": [{"description": "App state", "value": json.dumps({"courseId": "c", "webSearch": True})}]}}
    off = {"copilotkit": {"context": [{"description": "App state", "value": json.dumps({"courseId": "c", "webSearch": False})}]}}
    assert web_search_enabled(on, None) and not web_search_enabled(off, None) and not web_search_enabled({}, None)
    assert web_search_enabled({"copilotkit": {"context": [{"description": "webSearch", "value": "true"}]}}, None)

    class Req(SimpleNamespace):
        def override(self, **kw):
            return Req(**{**self.__dict__, **kw})

    mw = WebSearchToggle()
    req = mw._with_tool(Req(state=on, runtime=SimpleNamespace(context=None), tools=["t"]))
    assert req.tools == ["t", WEB_SEARCH_TOOL]
    assert mw._with_tool(req).tools == ["t", WEB_SEARCH_TOOL]  # not added twice
    assert mw._with_tool(Req(state=off, runtime=SimpleNamespace(context=None), tools=["t"])).tools == ["t"]


# ---- evals (no key: dataset sanity, structural grading, the runner refuses) ------------------------


def test_eval_dataset_and_runner_without_key(capsys):
    from app.seed import SEED_DIR
    from evals import builder, tutor
    from evals.run import main

    qs = tutor.load()
    keys = {ch["key"] for m in json.loads((SEED_DIR / "outline.json").read_text())["modules"] for ch in m["chapters"]}
    assert len(qs) == 30 and sum(bool(q.get("outOfScope")) for q in qs) == 5
    assert len({q["id"] for q in qs}) == 30
    assert all(set(q["chapters"]) <= keys and q["facts"] for q in qs)

    s = builder.structural(SEED_DIR)
    assert s["parses"] and s["chapters"] == 10 and s["flowErrors"] == {} if flowmovie.node_bin() else s["parses"]

    with pytest.raises(SystemExit) as e:
        main(["tutor", "--limit", "2"])
    assert e.value.code == 2
    out = capsys.readouterr()
    assert "Cost estimate" in out.out and "ANTHROPIC_API_KEY is not set" in out.err
    assert main(["interviewer", "--estimate"]) == 0


def test_provider_switch(monkeypatch):
    """An Anthropic-compatible provider (MiniMax) drops Claude-only features."""
    from app import config
    from app.agents import llm

    monkeypatch.setenv("ANTHROPIC_BASE_URL", "https://api.minimax.io/anthropic")
    monkeypatch.setenv("CW_MODEL", "MiniMax-M3")
    assert not config.is_anthropic()
    assert config.model() == "MiniMax-M3"
    m = llm.chat_model("high")
    assert m.model == "MiniMax-M3"
    assert getattr(m, "effort", None) in (None, "")
    monkeypatch.delenv("ANTHROPIC_BASE_URL")
    monkeypatch.delenv("CW_MODEL")
    assert config.is_anthropic() and config.model() == "claude-opus-5-5"


def test_interview_ends_on_repeat_and_at_cap(monkeypatch):
    """A model that re-asks a header, or an interview at the cap, finishes with a summary."""
    from app.agents import llm
    from app.api import interview as iv

    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    q = {"id": "level", "header": "Level", "question": "How much do you know?", "multiSelect": False,
         "options": [{"label": "A", "description": "a"}, {"label": "B", "description": "b"}]}

    async def fake_parse(*, schema, **_):
        if schema is iv.ClaudeSummary:
            return iv.ClaudeSummary(summary="A short course."), {}
        return iv.ClaudeStep(question=iv.InterviewQuestion(**q)), {}  # no level/goal/pace: must still validate

    monkeypatch.setattr(llm, "parse", fake_parse)
    first = asyncio.run(iv._claude(iv.InterviewIn(topic="Raft", answers=[])))
    assert first["question"]["header"] == "Level"
    again = asyncio.run(iv._claude(iv.InterviewIn(topic="Raft", answers=[iv.Answer(question="x", answer=["A"], header="level")])))
    assert again["done"] and again["summary"] == "A short course."
    capped = asyncio.run(iv._claude(iv.InterviewIn(topic="Raft", answers=[iv.Answer(question=f"q{i}", answer=["A"]) for i in range(6)])))
    assert capped["done"]


def test_repair_minimax_shapes():
    """Hoisted nested fields, "false" strings and {"item": [...]} arrays validate after repair."""
    from app.agents.llm import _inline_refs, _repair
    from app.api import interview as iv

    raw = {"done": False, "multiSelect": "false",
           "options": {"item": [{"label": "A", "description": "a", "recommended": "true"},
                                {"label": "B", "description": "b", "recommended": "false"}]},
           "question": {"header": "Level", "id": "level", "question": "How much?"}}
    step = iv.ClaudeStep.model_validate(_repair(raw, _inline_refs(iv.ClaudeStep.model_json_schema())))
    assert step.question.multiSelect is False and step.question.options[0].recommended is True
