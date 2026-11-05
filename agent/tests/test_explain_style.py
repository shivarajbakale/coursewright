"""First-principles, plain-language explaining is part of every agent that writes what the learner reads."""

from __future__ import annotations

from app import config


def test_every_course_writer_gets_the_explain_rules(monkeypatch, tmp_path):
    import deepagents

    captured: dict = {}
    monkeypatch.setattr(deepagents, "create_deep_agent", lambda **kw: captured.update(kw))
    from app.agents.builder import build_agent

    build_agent(tmp_path, web_search=False)
    prompts = {s["name"]: s["system_prompt"] for s in captured["subagents"] if "system_prompt" in s}
    for name in ("curriculum", "writer", "project_designer", "reviewer"):
        assert "How to explain: always from first principles" in prompts[name], name
    assert "How to explain: always from first principles" in captured["system_prompt"]
    # The reviewer treats unclear writing as blocking, not as a suggestion.
    assert "a term or acronym used before it is defined" in prompts["reviewer"]


def test_tutor_and_quizzes_explain_from_first_principles():
    assert "first principles" in config.prompt("tutor")
    assert "Plain words" in config.prompt("quiz")


def test_every_course_starts_from_the_basics_and_stays_lean():
    fmt = config.prompt("course_format")
    assert "Every course starts from the basics, whatever the learner's level" in fmt
    assert "At most about half the chapters get one" in fmt  # diagrams cost a draw-and-check loop each
    assert "Module 1 is always the foundations" in config.prompt("curriculum")
    assert "never more than 14" in config.prompt("curriculum")
    reviewer = config.prompt("reviewer")
    assert "the course starts from the basics" in reviewer and "Blocking above 1400 words" in reviewer
    assert "never more than 1200" in config.prompt("writer")
    assert "never offer an option that skips them" in config.prompt("interviewer")


def test_fallback_interview_never_offers_to_skip_the_basics():
    from app.api.interview import _fallback_questions

    text = str(_fallback_questions("Raft"))
    assert "Skip the basics" not in text and "skip the basics" not in text
