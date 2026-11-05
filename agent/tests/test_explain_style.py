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
    for name in ("ResearchOut", "CourseOutline"):
        assert "How to explain: always from first principles" in seen[name], name
    for name in ("writer", "project_designer", "reviewer", "curriculum", "outline_chat"):
        assert config.prompt(name).strip(), name
    # The reviewer treats unclear writing as blocking, not as a suggestion.
    assert "a term or acronym used before it is defined" in config.prompt("reviewer")


def test_tutor_and_quizzes_explain_from_first_principles():
    assert "first principles" in config.prompt("tutor")
    assert "Plain words" in config.prompt("quiz")


def test_every_course_starts_from_the_basics_and_stays_lean():
    fmt = config.prompt("course_format")
    assert "Every course starts from the basics, whatever the learner's level" in fmt
    assert "Module 1 is always the foundations" in config.prompt("curriculum")
    assert "never more than 14" in config.prompt("curriculum")
    reviewer = config.prompt("reviewer")
    assert "the course starts from the basics" in reviewer
    writer = config.prompt("writer")
    assert "never more than 1200" in writer
    assert "At most about half the chapters get one" in writer  # diagrams cost a draw-and-check loop each
    assert "never offer an option that skips them" in config.prompt("interviewer")


def test_fallback_interview_never_offers_to_skip_the_basics():
    from app.api.interview import _fallback_questions

    text = str(_fallback_questions("Raft"))
    assert "Skip the basics" not in text and "skip the basics" not in text
