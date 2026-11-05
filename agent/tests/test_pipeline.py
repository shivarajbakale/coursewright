"""The code-driven build pipeline: stages in order, checks in code, tokens per stage, the outline pause,
and resuming from the files on disk. The model is a fake that answers by output shape."""

from __future__ import annotations

import asyncio
import re

import pytest

from app.agents import diagrammer, llm
from app.db import db, jload
from app.jobs import build_course, pipeline, store
from app.materialise import CourseOutline, QuestionSpec
from tests.test_notifications import _course, _job

pytestmark = pytest.mark.usefixtures("client")  # runs the migrations

WORDS = " ".join(["Each step follows from the one before it, so you can check it by hand."] * 55)


def outline_data(extra_chapter: bool = False) -> dict:
    m2 = [{"key": "c03-tuning", "title": "Choosing the size", "summary": "How big to make it", "conceptKeys": ["c"]}]
    if extra_chapter:
        m2.append({"key": "c04-deletes", "title": "Deleting items", "summary": "Why deletes are hard", "conceptKeys": ["c"]})
    return {
        "title": "Bloom filters", "topic": "Bloom filters", "summary": "Fast set membership.", "colour": "teal", "icon": "",
        "concepts": [
            {"key": "a", "name": "Hashing", "summary": "Turning items into numbers"},
            {"key": "b", "name": "Bit arrays", "summary": "Rows of yes/no"},
            {"key": "c", "name": "False positives", "summary": "Wrong yes answers"},
        ],
        "edges": [{"from": "a", "to": "b"}, {"from": "b", "to": "c"}],
        "modules": [
            {"key": "m1", "title": "Foundations", "summary": "", "projectKey": "p1-filter",
             "chapters": [
                 {"key": "c01-hashing", "title": "Hashing from scratch", "summary": "Items to numbers", "conceptKeys": ["a"]},
                 {"key": "c02-bits", "title": "A row of bits", "summary": "Remembering with bits", "conceptKeys": ["b"]},
             ]},
            {"key": "m2", "title": "Using it well", "summary": "", "projectKey": "p2-tuned", "chapters": m2},
        ],
    }


class FakeModel:
    """Answers llm.parse by schema, counting calls; `bad_first` makes the first chapter fail its checks once."""

    def __init__(self, bad_first: bool = False, blocking: bool = True) -> None:
        self.calls: list[str] = []
        self.bad_first = bad_first
        self.blocking = blocking
        self.wrong: set[str] = set()  # chapter titles the verifier finds a mistake in

    async def parse(self, *, system, user, schema, **_):
        name = schema.__name__
        self.calls.append(name)
        usage = {"inputTokens": 1000, "outputTokens": 100}
        if name == "ResearchOut":
            return pipeline.ResearchOut(notes="## Problem\nChecking membership fast.", terms=["hash", "bit array"]), usage
        if name == "CourseOutline":
            return CourseOutline.model_validate(outline_data()), usage
        if name == "ChapterOut":
            title = re.search(r'Write chapter \[[^\]]+\] "([^"]+)"', user).group(1)
            if self.bad_first and self.calls.count("ChapterOut") == 1:
                return pipeline.ChapterOut(markdown=f"# {title}\n\nToo short, simply.", questions=[]), usage
            q = QuestionSpec(prompt="Why?", options=["Because", "No"], answer=0, explanation="It follows.")
            req = {"title": "Hashing an item", "show": "An item goes through three hashes.", "shape": "process"}
            return pipeline.ChapterOut(
                markdown=f"# {title}\n\n## The problem\n\n{WORDS}\n\n> **Key idea:** bits remember.\n",
                questions=[q, q], diagramRequest=req if "hashing" in title.lower() else None,
            ), usage
        if name == "ProjectSpec":
            return schema.model_validate({"title": "Build a filter", "brief": "Build it.",
                                          "rubric": [{"criterion": "Works", "chapterKey": "nope"}],
                                          "milestones": [{"title": "First", "body": "Do it", "checkCmd": "pytest"}]}), usage
        if name == "VerifyOut":
            wrong = any(f"# {t}" in user for t in self.wrong)
            return pipeline.VerifyOut(issues=["'2 + 2 = 5' should be 4"] if wrong else []), usage
        if name == "ReviewOut":
            blocking = [{"chapterKey": "c02-bits", "problem": "Uses 'bit' before defining it."}] if self.blocking else []
            return pipeline.ReviewOut.model_validate({"blocking": blocking}), usage
        if name == "OutlineChatOut":
            return pipeline.OutlineChatOut(outline=CourseOutline.model_validate(outline_data(True)),
                                           reply="Added 2.2 Deleting items, 4 chapters now."), usage
        raise AssertionError(name)


@pytest.fixture
def fake(monkeypatch):
    model = FakeModel()
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr(llm, "parse", model.parse)

    async def movie(spec, **_):
        model.calls.append("movie")
        return {"kind": "mermaid", "title": "Hashing an item", "source": "%% title: Hashing an item\nflowchart LR\n  a --> b\n",
                "usage": {"inputTokens": 500, "outputTokens": 50}}

    monkeypatch.setattr(diagrammer, "make_movie", movie)
    return model


def _build(brief: dict, title: str = "Bloom filters") -> tuple[str, dict]:
    cid = _course(title)
    with db() as conn:
        conn.execute("UPDATE courses SET brief=? WHERE id=?", (__import__("json").dumps(brief), cid))
    job = _job("build_course", {"brief": brief}, cid)
    return cid, job


def _status(cid: str) -> str:
    with db() as conn:
        return conn.execute("SELECT status FROM courses WHERE id=?", (cid,)).fetchone()[0]


def test_build_runs_every_stage_in_order_and_counts_tokens_per_stage(fake):
    cid, job = _build({"topic": "Bloom filters"})
    out = asyncio.run(build_course.run(job))

    assert _status(cid) == "ready"
    names = fake.calls
    assert names[:2] == ["ResearchOut", "CourseOutline"]
    assert names.count("ChapterOut") == 3 + 1  # three chapters, one targeted fix after the review
    assert names.count("movie") == 1 and names.count("ProjectSpec") == 2 and names.count("ReviewOut") == 1
    stages = out["usage"]["stages"]
    assert set(stages) == {"research", "curriculum", "chapters", "verify", "diagrams", "projects", "review", "fixes"}
    assert stages["verify"]["calls"] == 3
    assert stages["chapters"]["calls"] == 3
    assert out["usage"]["inputTokens"] == sum(s["inputTokens"] for s in stages.values())
    with db() as conn:
        assert jload(store.get_job(conn, job["id"])["usage"])["stages"] == stages  # kept on the job as it goes
        assert conn.execute("SELECT COUNT(*) FROM chapters WHERE course_id=?", (cid,)).fetchone()[0] == 3
        assert conn.execute(
            "SELECT COUNT(*) FROM diagrams d JOIN chapters c ON c.id=d.chapter_id WHERE c.course_id=?", (cid,)
        ).fetchone()[0] == 1
        rubric = conn.execute("SELECT rubric FROM projects WHERE course_id=? LIMIT 1", (cid,)).fetchone()[0]
        assert jload(rubric)[0]["chapterId"] is None  # an unknown chapter key is dropped, not fatal


def test_a_chapter_that_fails_its_checks_is_sent_back_once(fake):
    fake.bad_first = True
    cid, job = _build({"topic": "Bloom filters"}, "Checked chapters")
    asyncio.run(build_course.run(job))
    assert fake.calls.count("ChapterOut") == 3 + 1 + 1  # the bad one retried, plus the review fix
    assert _status(cid) == "ready"


def test_continue_skips_work_already_on_disk(fake):
    cid, job = _build({"topic": "Bloom filters"}, "Resumed course")
    asyncio.run(build_course.run(job))
    before = len(fake.calls)
    with db() as conn:
        conn.execute("UPDATE courses SET status='failed' WHERE id=?", (cid,))
    asyncio.run(build_course.run(job))  # everything is on disk: nothing is asked of the model again
    assert len(fake.calls) == before and _status(cid) == "ready"


def test_review_outline_pauses_after_the_outline(fake):
    cid, job = _build({"topic": "Bloom filters", "reviewOutline": True}, "Paused course")
    out = asyncio.run(build_course.run(job))
    assert out["phase"] == "plan" and _status(cid) == "planning"
    assert fake.calls == ["ResearchOut", "CourseOutline"]  # no chapter written before you agree
    with db() as conn:
        plan = conn.execute("SELECT approved_at, workdir FROM course_plans WHERE course_id=?", (cid,)).fetchone()
    assert plan["approved_at"] is None and plan["workdir"] == job["id"]


def test_outline_checks_catch_what_a_model_gets_wrong():
    data = outline_data()
    data["modules"][0]["chapters"][0]["conceptKeys"] = ["b"]  # chapter 1 teaches b, whose prerequisite a comes later
    data["modules"][0]["chapters"][1]["conceptKeys"] = ["a"]
    data["concepts"].append({"key": "d", "name": "Orphan", "summary": ""})
    problems = pipeline.outline_problems(CourseOutline.model_validate(data))
    text = " ".join(problems)
    assert "no chapter teaches it" in text and "before its prerequisite" in text and "chapter 1 must start" in text
    repaired = pipeline.repair_outline(CourseOutline.model_validate(data))
    assert pipeline.outline_problems(repaired) == []
    assert "d" not in {c.key for c in repaired.concepts}


def test_chapter_checks():
    ok = pipeline.ChapterOut(markdown=f"# T\n\n{WORDS}\n\n> **Key idea:** x", questions=[
        QuestionSpec(prompt="?", options=["a", "b"], answer=0)] * 2)
    assert pipeline.chapter_problems(ok, "T") == []
    long = pipeline.ChapterOut(markdown=f"T\n\n{WORDS} {WORDS} obviously", questions=[])
    text = " ".join(pipeline.chapter_problems(long, "T"))
    for bit in ("must start with", "limit is 1200", "exactly one", "obviously", "2-4 questions"):
        assert bit in text, bit
    # Code blocks don't count towards the length.
    code = pipeline.ChapterOut(markdown=f"# T\n\n{WORDS}\n\n```\n{WORDS}\n```\n> **Key idea:** x", questions=ok.questions)
    assert pipeline.chapter_problems(code, "T") == []


def test_estimate_is_far_below_the_old_engine():
    est = pipeline.estimate_tokens(CourseOutline.model_validate(outline_data()))
    assert 50_000 < est < 200_000  # a 3-chapter course; the agent orchestrator spent millions


def test_tidy_fixes_what_code_can():
    out = pipeline.ChapterOut(markdown="Intro\n\n> **Key idea:** one\n\nMore\n\n> **Key idea:** two", questions=[])
    md = pipeline.tidy(out, "Hashing").markdown
    assert md.startswith("# Hashing\n") and md.count("> **Key idea:**") == 1 and "> two" in md


def test_a_reply_with_no_content_is_asked_again(monkeypatch):
    """A provider that returns an empty reply once doesn't sink the build."""
    from types import SimpleNamespace

    from app import config

    replies = [
        SimpleNamespace(content=None, stop_reason="end_turn", usage=None),
        SimpleNamespace(
            content=[SimpleNamespace(type="tool_use", id="t1", input={"notes": "n", "terms": ["a"]})],
            stop_reason="tool_use", usage=SimpleNamespace(input_tokens=10, output_tokens=5),
        ),
    ]

    class Messages:
        async def create(self, **_):
            return replies.pop(0)

    monkeypatch.setattr(config, "is_anthropic", lambda: False)
    monkeypatch.setattr(llm, "_client", lambda: SimpleNamespace(messages=Messages()))
    out, usage = asyncio.run(llm.parse(system="s", user="u", schema=pipeline.ResearchOut))
    assert out.notes == "n" and usage == {"inputTokens": 10, "outputTokens": 5} and not replies


def test_problem_kinds_tell_length_from_callouts():
    long = pipeline.ChapterOut(markdown=f"# T\n\n{WORDS} {WORDS}\n\n> **Key idea:** x", questions=[
        QuestionSpec(prompt="?", options=["a", "b"], answer=0)] * 2)
    two = pipeline.ChapterOut(markdown=f"# T\n\n{WORDS}\n\n> **Key idea:** x\n> **Key idea:** y", questions=long.questions)
    kinds = {pipeline.problem_kind(p) for o in (long, two) for p in pipeline.chapter_problems(o, "T")}
    assert kinds == {"the limit is", "Key idea"}
    quiz = pipeline.ChapterOut(markdown=f"# T\n\n{WORDS}\n\n> **Key idea:** x\n\n## Check yourself\n", questions=long.questions)
    assert [pipeline.problem_kind(p) for p in pipeline.chapter_problems(quiz, "T")] == ["quiz"]


def test_the_verifier_sends_a_wrong_chapter_back_with_its_mistake(fake):
    fake.wrong = {"A row of bits"}
    seen: list[str] = []
    real = fake.parse

    async def spy(*, user, schema, **kw):
        if schema.__name__ == "ChapterOut" and "found these problems" in user:
            seen.append(user)
        return await real(user=user, schema=schema, **kw)

    fake.parse = spy
    import app.agents.llm as llm_mod

    llm_mod.parse = spy
    cid, job = _build({"topic": "Bloom filters"}, "Verified course")
    out = asyncio.run(build_course.run(job))
    assert any("'2 + 2 = 5' should be 4" in u and "Current chapter:\n# A row of bits" in u for u in seen)
    assert out["usage"]["stages"]["verify"]["calls"] == 3 and _status(cid) == "ready"


def test_verifier_issues_as_objects_are_kept_as_words():
    out = pipeline.VerifyOut.model_validate({"issues": [
        {"quote": "2 + 2 = 5", "fix": "it is 4"}, "plain", "1/64 ≈ 0.01563 — correct. No error.", "The sum is correct."]})
    assert out.issues == ["2 + 2 = 5 it is 4", "plain"]


def test_a_failing_polish_stage_does_not_fail_the_build(fake, monkeypatch):
    real = fake.parse

    async def flaky(*, schema, **kw):
        if schema.__name__ in ("VerifyOut", "ReviewOut"):
            raise RuntimeError("model's structured output did not validate after a retry")
        return await real(schema=schema, **kw)

    monkeypatch.setattr(llm, "parse", flaky)
    cid, job = _build({"topic": "Bloom filters"}, "Flaky polish")
    asyncio.run(build_course.run(job))
    assert _status(cid) == "ready"
