"""The token budget is when a build stops polishing, not when it fails: a course that has written all its
files is saved as it stands; an incomplete one keeps going; only a runaway is stopped, in plain words."""

from __future__ import annotations

import asyncio

import pytest

from app.db import db
from app.jobs import store
from tests.test_notifications import _course, _job

pytestmark = pytest.mark.usefixtures("client")  # runs the migrations

def _fake_agent(n_chunks: int, per_chunk: int, closed: list):
    from langchain_core.messages import AIMessage

    class Agent:
        def astream(self, *_a, **_k):
            async def gen():
                try:
                    for i in range(n_chunks):
                        msg = AIMessage(content="", id=f"m{i}", usage_metadata={"input_tokens": per_chunk, "output_tokens": 0, "total_tokens": per_chunk})
                        yield ((), {"model": {"messages": [msg]}})
                finally:
                    closed.append(True)

            return gen()

    return Agent()


def _run_build(monkeypatch, tmp_path, *, complete: bool, n_chunks: int, per_chunk: int, resuming: bool = False):
    from contextlib import asynccontextmanager

    from app.agents import builder, checkpoint
    from app.jobs import build_course

    closed: list = []

    @asynccontextmanager
    async def saver():
        yield object()

    async def has_checkpoint(_cp, _tid):
        return resuming

    monkeypatch.setattr(checkpoint, "saver", saver)
    monkeypatch.setattr(checkpoint, "has_checkpoint", has_checkpoint)
    monkeypatch.setattr(builder, "build_agent", lambda *_a, **_k: _fake_agent(n_chunks, per_chunk, closed))
    monkeypatch.setattr(build_course, "_course_complete", lambda _d: complete)
    job = _job("build_course", {}, _course("Budget course"))
    if resuming:
        with db() as conn:
            conn.execute("UPDATE jobs SET usage=? WHERE id=?", ('{"inputTokens": 5, "outputTokens": 1}', job["id"]))
            job = dict(store.get_job(conn, job["id"]))
    progress = build_course.Progress(job["id"], tmp_path)
    asyncio.run(build_course._run_agents(job, tmp_path, {"topic": "Bloom filters"}, progress, budget=1_000_000))
    return progress, closed


def test_complete_course_past_budget_is_saved_not_failed(monkeypatch, tmp_path):
    progress, closed = _run_build(monkeypatch, tmp_path, complete=True, n_chunks=50, per_chunk=200_000)
    spent = progress.input_tokens + progress.output_tokens
    assert 1_000_000 < spent < 2_000_000  # stopped soon after the budget, not at the end of the stream
    assert closed == [True]  # the agent's stream was closed


def test_incomplete_course_keeps_going_past_budget(monkeypatch, tmp_path):
    progress, _ = _run_build(monkeypatch, tmp_path, complete=False, n_chunks=12, per_chunk=200_000)
    assert progress.input_tokens == 2_400_000  # past the budget, under the runaway limit: no error


def test_runaway_build_stops_with_a_plain_message(monkeypatch, tmp_path):
    with pytest.raises(RuntimeError) as e:
        _run_build(monkeypatch, tmp_path, complete=False, n_chunks=50, per_chunk=200_000)
    assert "CW_BUILD_TOKEN_BUDGET" not in str(e.value) and "Start the build again" in str(e.value)


def test_resumed_build_reads_its_usage(monkeypatch, tmp_path):
    progress, _ = _run_build(monkeypatch, tmp_path, complete=True, n_chunks=1, per_chunk=10, resuming=True)
    assert progress.input_tokens == 15  # 5 carried over from the job row, 10 from this run
