"""First-principles, plain-language explaining is part of every agent that writes what the learner reads."""

from __future__ import annotations

from app import config


def test_every_stage_that_writes_for_the_learner_gets_the_explain_rules(monkeypatch, tmp_path):
    """Each pipeline call that produces learner-facing text carries the shared rules."""
    import asyncio

    from app.agents import llm
    from app.jobs import pipeline

    seen: dict[str, str] = {}

    async def fake_parse(*, system, schema, **_):
        seen[schema.__name__] = system
        raise RuntimeError("stop")

    monkeypatch.setattr(llm, "parse", fake_parse)
    run = pipeline.Run(None, tmp_path, {"topic": "Bloom filters"}, pipeline.Ledger(None), emit=lambda *a: None)
    for coro in (run.research(), run.curriculum("notes")):
        try:
            asyncio.run(coro)
        except RuntimeError:
            pass
    for name in ("ResearchOut", "CurriculumOut"):
        assert "How to explain: always from first principles" in seen[name], name
    for name in ("writer", "project_designer", "beginner", "curriculum", "outline_chat"):
        assert config.prompt(name).strip(), name
    # The beginner reader treats an unexplained term as a sticking point, not a style note.
    assert "used without being explained" in config.prompt("beginner")


def test_tutor_and_quizzes_explain_from_first_principles():
    assert "first principles" in config.prompt("tutor")
    assert "Plain words" in config.prompt("quiz")


def test_every_course_starts_from_the_basics_one_concept_at_a_time():
    fmt = config.prompt("course_format")
    assert "Every course starts from the basics, whatever the learner's level" in fmt
    assert "One concept per lesson" in fmt
    cur = config.prompt("curriculum")
    assert "The learner's experience never raises the floor" in cur
    assert "Each concept becomes exactly one lesson" in cur and "never more than 90" in cur
    assert "Never a\n  slogan or teaser" in cur
    writer = config.prompt("writer")
    assert "never more than 800" in writer and "Never write as if they have used or built" in writer
    assert "Most lessons don't need one" in writer  # every lesson gets its map; movies cost a draw-and-check loop
    assert "never offer an option that skips them" in config.prompt("interviewer")


def test_fallback_interview_never_offers_to_skip_the_basics():
    from app.api.interview import _fallback_questions

    text = str(_fallback_questions("Raft"))
    assert "Skip the basics" not in text and "skip the basics" not in text
