"""The code-driven build pipeline: stages in order, checks in code, tokens per stage, the outline pause,
and resuming from the files on disk. The model is a fake that answers by output shape."""

from __future__ import annotations

import asyncio
import re

import pytest

from app.agents import diagrammer, llm
from app.db import db, jload
from app.jobs import build_course, pedagogy, pipeline, store
from app.materialise import CourseOutline, QuestionSpec
from tests.test_notifications import _course, _job

pytestmark = pytest.mark.usefixtures("client")  # runs the migrations

WORDS = " ".join(["Each step follows from the one before it, so you can check it by hand."] * 30)

# The fake curriculum: three concepts, one lesson each, in two modules. `to_outline` turns it into the
# outline below (`outline_data`), which the outline-review tests reshape.
LESSONS = [
    ("hashing", "Hashing", "turning items into numbers", "Items to numbers", [], ["hash function"]),
    ("bits", "Bit arrays", "a row of yes or no answers", "Remembering with bits", ["hashing"], []),
    ("tuning", "Filter size", "choosing how big to make it", "How big to make it", ["bits"], []),
]


def curriculum() -> "pipeline.CurriculumOut":
    def lesson(row):
        key, name, plain, summary, pre, terms = row
        return {"key": key, "name": name, "plain": plain, "summary": summary, "prerequisites": pre, "terms": terms}

    return pipeline.CurriculumOut.model_validate({
        "title": "Bloom filters", "summary": "Fast set membership, from zero.", "colour": "teal",
        "floor": "You can write a small Python program.",
        "modules": [
            {"title": "Foundations", "lessons": [lesson(LESSONS[0]), lesson(LESSONS[1])]},
            {"title": "Using it well", "lessons": [lesson(LESSONS[2])]},
        ],
    })


def outline_data(extra_chapter: bool = False) -> dict:
    data = pipeline.to_outline(curriculum(), topic="Bloom filters").model_dump(by_alias=True)
    if extra_chapter:
        data["concepts"].append({"key": "deletes", "name": "Deletes", "summary": "Why deletes are hard"})
        data["edges"].append({"from": "bits", "to": "deletes"})
        data["modules"][1]["chapters"].append({
            "key": "c04-deletes", "title": "Deletes: why removing an item is hard", "readingMinutes": 4,
            "summary": "Why deletes are hard", "conceptKeys": ["deletes"],
        })
    return data


def lesson_markdown(title: str, body: str = WORDS) -> str:
    return f"# {title}\n\n{body}\n\n> **Key idea:** bits remember.\n\n## What you have now\n\nA way in.\n"


class FakeModel:
    """Answers llm.parse by schema, counting calls; `bad_first` makes the first lesson fail its checks once,
    `stuck` the lessons (by title) the beginner reader gets stuck in."""

    def __init__(self, bad_first: bool = False) -> None:
        self.calls: list[str] = []
        self.bad_first = bad_first
        self.wrong: set[str] = set()  # lesson titles the verifier finds a mistake in
        self.stuck: set[str] = set()
        self.stubborn = False  # revisions don't help the newcomer
        self.gradual = False  # each revision helps a little
        self.users: dict[str, list[str]] = {}

    async def parse(self, *, system, user, schema, **_):
        name = schema.__name__
        self.calls.append(name)
        self.users.setdefault(name, []).append(user)
        usage = {"inputTokens": 1000, "outputTokens": 100}
        if name == "ResearchOut":
            return pipeline.ResearchOut(notes="## Problem\nChecking membership fast.", terms=["hash", "bit array"]), usage
        if name == "CurriculumOut":
            return curriculum(), usage
        if name == "ChapterOut":
            title = re.search(r'Write lesson \[[^\]]+\] "([^"]+)"', user).group(1)
            concept = title.split(":")[0]
            if self.bad_first and self.calls.count("ChapterOut") == 1:
                return pipeline.ChapterOut(markdown=f"# {title}\n\nToo short, simply.", questions=[]), usage
            q = QuestionSpec(prompt="Why?", options=["Because", "No"], answer=0, explanation="It follows.")
            req = {"title": "Hashing an item", "show": "An item goes through three hashes.", "shape": "process"}
            clearer = user.count("Clearer now.") + 1 if "fix these problems" in user and not self.stubborn else 0
            body = WORDS + " Clearer now." * clearer
            return pipeline.ChapterOut(
                markdown=lesson_markdown(title, body), uses=[],
                defines=[{"term": concept, "meaning": "it"}] + ([{"term": "hash function"}] if concept == "Hashing" else []),
                questions=[q, q], diagramRequest=req if "hashing" in title.lower() else None,
            ), usage
        if name == "ReaderOut":
            hit = any(f"# {t}" in user for t in self.stuck)
            left = (2 if self.gradual else 1) - user.count("Clearer now.")
            stuck = [{"quote": "Each step", "why": "which step?"}] * max(0, left) if hit else []
            return pipeline.ReaderOut.model_validate({"stuck": stuck, "answers": [0, 0]}), usage
        if name == "ProjectSpec":
            return schema.model_validate({"title": "Build a filter", "brief": "Build it.",
                                          "rubric": [{"criterion": "Works", "chapterKey": "nope"}],
                                          "milestones": [{"title": "First", "body": "Do it", "checkCmd": "pytest"}]}), usage
        if name == "VerifyOut":
            wrong = any(f"# {t}" in user for t in self.wrong)
            return pipeline.VerifyOut(issues=["'2 + 2 = 5' should be 4"] if wrong else []), usage
        if name == "OutlineChatOut":
            return pipeline.OutlineChatOut(outline=CourseOutline.model_validate(outline_data(True)),
                                           reply="Added 2.2 Deletes: why removing an item is hard, 4 lessons now."), usage
        raise AssertionError(name)


@pytest.fixture
def fake(monkeypatch):
    model = FakeModel()
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr(pipeline, "MIN_CHAPTERS", 1)  # the fake course is three lessons
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




T1, T2, T3 = (pipeline.to_outline(curriculum()).modules[0].chapters[0].title,
              pipeline.to_outline(curriculum()).modules[0].chapters[1].title,
              pipeline.to_outline(curriculum()).modules[1].chapters[0].title)


def test_build_runs_every_stage_in_order_and_counts_tokens_per_stage(fake):
    cid, job = _build({"topic": "Bloom filters"})
    out = asyncio.run(build_course.run(job))

    assert _status(cid) == "ready"
    names = fake.calls
    assert names[:2] == ["ResearchOut", "CurriculumOut"]
    assert names.count("ChapterOut") == 3 and names.count("ReaderOut") == 3  # every lesson read by a newcomer
    assert names.count("movie") == 1 and names.count("ProjectSpec") == 2 and names.count("VerifyOut") == 3
    stages = out["usage"]["stages"]
    assert set(stages) == {"research", "curriculum", "chapters", "reader", "verify", "diagrams", "projects"}
    assert out["usage"]["inputTokens"] == sum(s["inputTokens"] for s in stages.values())
    with db() as conn:
        assert jload(store.get_job(conn, job["id"])["usage"])["stages"] == stages  # kept on the job as it goes
        titles = {r[0] for r in conn.execute("SELECT title FROM chapters WHERE course_id=?", (cid,))}
        assert titles == {T1, T2, T3} == {"Hashing: turning items into numbers",
                                          "Bit arrays: a row of yes or no answers",
                                          "Filter size: choosing how big to make it"}
        maps = conn.execute(
            "SELECT COUNT(*) FROM diagrams d JOIN chapters c ON c.id=d.chapter_id WHERE c.course_id=? AND d.title=?",
            (cid, "Your map so far"),
        ).fetchone()[0]
        assert maps == 3  # every lesson ends with the map of what you have so far, drawn by code
        assert conn.execute(
            "SELECT COUNT(*) FROM diagrams d JOIN chapters c ON c.id=d.chapter_id WHERE c.course_id=?", (cid,)
        ).fetchone()[0] == 4
        rubric = conn.execute("SELECT rubric FROM projects WHERE course_id=? LIMIT 1", (cid,)).fetchone()[0]
        assert jload(rubric)[0]["chapterId"] is None  # an unknown chapter key is dropped, not fatal


def test_lessons_know_the_planned_terms_of_earlier_lessons_without_waiting_for_them(fake):
    _, job = _build({"topic": "Bloom filters"}, "Parallel course")
    asyncio.run(build_course.run(job))
    prompts = {re.search(r'Write lesson \[([^\]]+)\]', u).group(1): u for u in fake.users["ChapterOut"]}
    assert "Terms the learner knows from earlier lessons: (none: this is the first lesson)" in prompts["c01-hashing"]
    assert "It also explains these supporting terms (later lessons rely on them): hash function" in prompts["c01-hashing"]
    assert "Terms the learner knows from earlier lessons: Hashing, hash function" in prompts["c02-bits"]
    assert f"It builds on these earlier lessons:\n- {T1}: Items to numbers" in prompts["c02-bits"]
    # Only what the lesson needs: no outline, and the next lesson by what it answers, never by its name.
    assert "Filter size" not in prompts["c02-bits"]
    assert "The next lesson answers: choosing how big to make it" in prompts["c02-bits"]
    assert "Bit arrays" not in prompts["c01-hashing"]


def test_a_lesson_must_explain_its_planned_terms():
    title = "Bit arrays: a row of yes or no answers"
    text = " ".join(pipeline.chapter_problems(_lesson(), title, _ctx(planned=["bit mask"])))
    assert "Explain bit mask" in text
    assert pipeline.chapter_problems(_lesson(defines=[{"term": "Bit array"}, {"term": "bit mask"}]), title,
                                     _ctx(planned=["bit mask"])) == []


def test_the_learners_level_never_reaches_the_curriculum_or_a_lesson(fake):
    brief = {"topic": "Bloom filters", "level": "Shipped Bloom filters in production", "goal": "Ship one",
             "answers": [{"question": "Where are you starting with Bloom filters?", "answer": ["Shipped them in production"]},
                         {"question": "Which stack should the course use?", "answer": ["Python"]}]}
    _, job = _build(brief, "Levelled course")
    asyncio.run(build_course.run(job))
    for name in ("ResearchOut", "CurriculumOut", "ChapterOut"):
        for u in fake.users[name]:
            assert "production" not in u, name
        assert "Python" in fake.users[name][0] and "Goal: Ship one" in fake.users[name][0]


def test_a_lesson_that_fails_its_checks_is_sent_back_once(fake):
    fake.bad_first = True
    cid, job = _build({"topic": "Bloom filters"}, "Checked chapters")
    asyncio.run(build_course.run(job))
    assert fake.calls.count("ChapterOut") == 3 + 1
    assert _status(cid) == "ready"


def test_a_lesson_a_newcomer_gets_stuck_in_is_revised_with_the_quotes_and_read_again(fake):
    fake.stuck = {T2}
    cid, job = _build({"topic": "Bloom filters"}, "Read course")
    out = asyncio.run(build_course.run(job))
    assert fake.calls.count("ChapterOut") == 3 + 1 and out["usage"]["stages"]["revisions"]["calls"] == 1
    assert fake.calls.count("ReaderOut") == 3 + 1  # the revision is read again
    revision = [u for u in fake.users["ChapterOut"] if "fix these problems" in u]
    assert len(revision) == 1 and 'A newcomer got stuck at "Each step": which step?' in revision[0]
    assert f"Current lesson:\n# {T2}" in revision[0]
    with db() as conn:
        md = conn.execute("SELECT markdown FROM chapters WHERE course_id=? AND title=?", (cid, T2)).fetchone()[0]
    assert "Clearer now." in md and _status(cid) == "ready"


def test_revisions_go_on_while_they_help_and_stop_when_they_dont(fake, monkeypatch):
    assert pipeline.READ_ROUNDS == 1  # one revision by default: clarity against cost
    monkeypatch.setattr(pipeline, "READ_ROUNDS", 2)
    fake.stuck, fake.gradual = {T2}, True
    _, job = _build({"topic": "Bloom filters"}, "Gradual course")
    out = asyncio.run(build_course.run(job))
    assert out["usage"]["stages"]["revisions"]["calls"] == 2

    fake.gradual, fake.stubborn = False, True
    cid, job = _build({"topic": "Bloom filters"}, "Stubborn course")
    out = asyncio.run(build_course.run(job))
    assert out["usage"]["stages"]["revisions"]["calls"] == 1  # no easier for the newcomer: no second round


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
    assert fake.calls == ["ResearchOut", "CurriculumOut"]  # no lesson written before you agree
    with db() as conn:
        plan = conn.execute("SELECT approved_at, workdir FROM course_plans WHERE course_id=?", (cid,)).fetchone()
    assert plan["approved_at"] is None and plan["workdir"] == job["id"]


def test_curriculum_checks_catch_what_a_model_gets_wrong():
    cur = curriculum().model_dump()
    m1 = cur["modules"][0]["lessons"]
    m1[0]["prerequisites"] = ["bits"]  # the first lesson needs a later one
    m1[1]["name"], m1[1]["plain"] = "Bit arrays, not lists", "why rows beat lists"  # a slogan
    m1[1]["summary"] = "You already know arrays, so this is a quick recap."
    cur["modules"][1]["lessons"][0]["plain"] = "how many bit arrays a Bloom filter needs"  # fine: taught before
    cur["modules"][1]["title"] = "From bits to a filter"
    cur["summary"] = "You have already built a cache."
    problems = " ".join(pipeline.curriculum_problems(pipeline.CurriculumOut.model_validate(cur)))
    for bit in ("which comes after it", "has prerequisites: the course must start from zero", "reads as a slogan",
                "assumes experience", "Module title", "this pace needs"):
        assert bit in problems, bit
    # A lesson that builds on nothing (after the first) leaves the map and the writing order blind.
    cur = curriculum().model_dump()
    cur["modules"][1]["lessons"][0]["prerequisites"] = []
    assert "1 lessons list no prerequisites (Filter size)" in " ".join(
        pipeline.curriculum_problems(pipeline.CurriculumOut.model_validate(cur)))
    cur = curriculum().model_dump()
    cur["modules"][0]["lessons"][0]["terms"] = ["Filter size"]
    assert "a later lesson's concept" in " ".join(pipeline.curriculum_problems(pipeline.CurriculumOut.model_validate(cur)))
    # A title naming a concept a later lesson teaches is caught too.
    cur = curriculum().model_dump()
    cur["modules"][0]["lessons"][0]["plain"] = "the first step of a filter size estimate"
    assert "which a later lesson teaches" in " ".join(pipeline.curriculum_problems(pipeline.CurriculumOut.model_validate(cur)))


def test_to_outline_makes_one_chapter_per_concept_with_plain_titles():
    cur = curriculum().model_dump()
    cur["modules"][0]["lessons"][1]["prerequisites"] = ["hashing", "tuning"]  # tuning comes later: dropped
    outline = pipeline.to_outline(pipeline.CurriculumOut.model_validate(cur), topic="Bloom filters")
    chapters = [ch for m in outline.modules for ch in m.chapters]
    assert [ch.key for ch in chapters] == ["c01-hashing", "c02-bits", "c03-tuning"]
    assert all(len(ch.conceptKeys) == 1 for ch in chapters)
    assert [(e.from_, e.to) for e in outline.edges] == [("hashing", "bits"), ("bits", "tuning")]
    assert [m.projectKey for m in outline.modules] == ["p1-foundations", "p2-using-it-well"]
    assert pipeline.outline_problems(outline) == []
    assert pipeline.to_outline(pipeline.CurriculumOut.model_validate(cur), projects=False).modules[0].projectKey is None


def test_outline_checks_catch_what_a_model_gets_wrong():
    data = outline_data()
    data["modules"][0]["chapters"][0]["conceptKeys"] = ["bits"]  # chapter 1 teaches bits, whose prerequisite comes later
    data["modules"][0]["chapters"][1]["conceptKeys"] = ["hashing"]
    data["modules"][1]["chapters"][0]["title"] = "State, not size"
    data["modules"][1]["chapters"][0]["conceptKeys"] = ["tuning", "hashing"]
    data["concepts"].append({"key": "d", "name": "Orphan", "summary": ""})
    problems = pipeline.outline_problems(CourseOutline.model_validate(data))
    text = " ".join(problems)
    for bit in ("no chapter teaches it", "before its prerequisite", "chapter 1 must start", "exactly one",
                "reads as a slogan", "does not start with the concept"):
        assert bit in text, bit
    repaired = pipeline.repair_outline(CourseOutline.model_validate(outline_data() | {"concepts": outline_data()["concepts"] + [{"key": "d", "name": "Orphan", "summary": ""}]}))
    assert pipeline.outline_problems(repaired) == []
    assert "d" not in {c.key for c in repaired.concepts}


def _ctx(**kw):
    base = {"concept": "Bit arrays", "glossary": pedagogy.Glossary.of(["Hashing", "hash function"]),
            "later": ["Filter size", "False positive rate"], "vocabulary": ["bit array", "false positive rate", "hash"]}
    return pipeline.LessonContext(**(base | kw))


def _lesson(md: str = lesson_markdown("Bit arrays: a row of yes or no answers"), **kw):
    q = QuestionSpec(prompt="?", options=["a", "b"], answer=0)
    return pipeline.ChapterOut(**({"markdown": md, "defines": [{"term": "Bit array"}], "uses": ["hash function"],
                                   "questions": [q, q]} | kw))


def test_lesson_checks():
    title = "Bit arrays: a row of yes or no answers"
    assert pipeline.chapter_problems(_lesson(), title, _ctx()) == []
    text = " ".join(pipeline.chapter_problems(_lesson(uses=["Bloom filter index", "hash function"]), title, _ctx()))
    assert "uses Bloom filter index before any lesson explained it" in text
    leak = lesson_markdown(title, WORDS + " Later the false positive rate matters.")
    assert "which a later lesson teaches" in " ".join(pipeline.chapter_problems(_lesson(leak), title, _ctx()))
    assumes = lesson_markdown(title, "You already have a working filter. " + WORDS)
    assert "assumes the learner" in " ".join(pipeline.chapter_problems(_lesson(assumes), title, _ctx()))
    nowrap = _lesson(f"# {title}\n\n{WORDS}\n\n> **Key idea:** x\n")
    assert "What you have now" in " ".join(pipeline.chapter_problems(nowrap, title, _ctx()))
    many = _lesson(defines=[{"term": t} for t in ("Bit array", "Bit", "Byte", "Word", "Mask")])
    assert "new terms" in " ".join(pipeline.chapter_problems(many, title, _ctx()))
    other = _lesson(defines=[{"term": "Byte"}])
    assert "own concept" in " ".join(pipeline.chapter_problems(other, title, _ctx()))
    # Plain words the writer lists are the floor, not a gap; code blocks don't count towards the length.
    assert pipeline.chapter_problems(_lesson(uses=["function", "list"]), title, _ctx()) == []
    code = lesson_markdown(title, f"{WORDS}\n\n```\n{WORDS} {WORDS}\n```")
    assert pipeline.chapter_problems(_lesson(code), title, _ctx()) == []
    long = pipeline.ChapterOut(markdown=f"T\n\n{WORDS} {WORDS} obviously", questions=[])
    text = " ".join(pipeline.chapter_problems(long, "T"))
    for bit in ("must start with", "limit is 800", "exactly one", "obviously", "2-3 questions"):
        assert bit in text, bit


def test_estimate_scales_with_the_lessons():
    est = pipeline.estimate_tokens(CourseOutline.model_validate(outline_data()))
    assert 100_000 < est < 300_000  # a 3-lesson course; a 65-lesson one measured 4.0M


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
    title = "T"
    long = _lesson(lesson_markdown(title, f"{WORDS} {WORDS}"))
    two = _lesson(lesson_markdown(title).replace("## What", "> **Key idea:** y\n\n## What"))
    kinds = {pipeline.problem_kind(p) for o in (long, two) for p in pipeline.chapter_problems(o, title)}
    assert kinds == {"the limit is", "Key idea"}
    quiz = _lesson(lesson_markdown(title) + "\n## Check yourself\n")
    assert [pipeline.problem_kind(p) for p in pipeline.chapter_problems(quiz, title)] == ["quiz"]


def test_the_verifier_sends_a_wrong_lesson_back_with_its_mistake(fake):
    fake.wrong = {T2}
    cid, job = _build({"topic": "Bloom filters"}, "Verified course")
    out = asyncio.run(build_course.run(job))
    fixes = [u for u in fake.users["ChapterOut"] if "fix these problems" in u]
    assert any("'2 + 2 = 5' should be 4" in u and f"Current lesson:\n# {T2}" in u for u in fixes)
    assert out["usage"]["stages"]["verify"]["calls"] == 3 and out["usage"]["stages"]["fixes"]["calls"] == 1
    assert _status(cid) == "ready"


def test_verifier_issues_as_objects_are_kept_as_words():
    out = pipeline.VerifyOut.model_validate({"issues": [
        {"quote": "2 + 2 = 5", "fix": "it is 4"}, "plain", "1/64 ≈ 0.01563 — correct. No error.", "The sum is correct."]})
    assert out.issues == ["2 + 2 = 5 it is 4", "plain"]


def test_a_failing_polish_stage_does_not_fail_the_build(fake, monkeypatch):
    real = fake.parse

    async def flaky(*, schema, **kw):
        if schema.__name__ in ("VerifyOut", "ReaderOut"):
            raise RuntimeError("model's structured output did not validate after a retry")
        return await real(schema=schema, **kw)

    monkeypatch.setattr(llm, "parse", flaky)
    cid, job = _build({"topic": "Bloom filters"}, "Flaky polish")
    asyncio.run(build_course.run(job))
    assert _status(cid) == "ready"


def test_the_map_so_far_highlights_the_new_concept():
    src = pedagogy.map_so_far([("a", "Hashing"), ("b", "Bit arrays"), ("c", "Filter size")], [("a", "b"), ("b", "c")], 1)
    assert 'n0["Hashing"]' in src and 'n1["Bit arrays"]' in src and "Filter size" not in src  # nothing from the future
    assert "n0 --> n1" in src and "class n1 new" in src


def test_a_revision_that_fails_keeps_the_draft(fake, monkeypatch):
    fake.stuck = {T2}
    real = fake.parse

    async def flaky(*, schema, user, **kw):
        if schema.__name__ == "ChapterOut" and "fix these problems" in user:
            raise RuntimeError("model's structured output did not validate after a retry")
        return await real(schema=schema, user=user, **kw)

    monkeypatch.setattr(llm, "parse", flaky)
    cid, job = _build({"topic": "Bloom filters"}, "Failed revision")
    asyncio.run(build_course.run(job))
    assert _status(cid) == "ready"


def test_a_lesson_gets_the_research_notes_that_concern_it():
    notes = ("## Core ideas\n- Hashing maps an item to a number.\n- A bit array is a row of yes or no bits.\n"
             "- The false positive rate grows as the bit array fills.\n\n## Good examples\n- Spell checkers.")
    picked = pedagogy.relevant_notes(notes, "Bit arrays: a row of yes or no answers")
    assert "row of yes or no bits" in picked and "Hashing maps" not in picked and "Spell" not in picked
    assert pedagogy.relevant_notes(notes, "zebra") == ""


def test_indexing_a_lesson_makes_no_model_call(monkeypatch):
    from app.rag import ingest

    calls = []

    async def text(**kw):
        calls.append(kw)
        return "context"

    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr("app.agents.llm.text", text)
    meta = {"mpos": 1, "cpos": 2, "module_title": "Foundations", "course_title": "Bloom filters"}
    where = asyncio.run(ingest._contextualise("chapter", "Bit arrays", meta, "Intro", "chunk", "doc", True))
    assert where.startswith("From chapter 1.2 Bit arrays") and calls == []
    asyncio.run(ingest._contextualise("url", "A page", {}, "", "chunk", "doc", True))
    assert len(calls) == 1  # a source whose structure we don't know still gets its sentence
