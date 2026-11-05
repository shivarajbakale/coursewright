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
