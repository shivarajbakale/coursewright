"""The tutor's make_drawing: a checked Inkling drawing in any of the 13 layouts. No keys, no network: the
model is a fake chat model."""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import pytest
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from app import config, flowmovie, inkling
from app.agents import diagrammer

needs_node = pytest.mark.skipif(flowmovie.node_bin() is None, reason="node is not installed")

GOOD = 'title "The agent loop"\nlayout cycle\nthink: circle "Think"\nact: circle "Act"\nlook: circle "Look"\ncycle think, act, look\nsteps auto\n'
BAD = 'title "The agent loop"\nlayout spiral\nthink: circle "Think"\n'


def fenced(src: str) -> str:
    return f"Here it is.\n\n```inkling\n{src}```\n"


@needs_node
def test_the_guide_shows_every_layout_and_each_example_is_clean():
    guide = inkling.fences(config.prompt("drawing"))
    layouts = {inkling.layout(f.source) for f in guide}
    assert layouts == set(inkling.LAYOUTS)
    for f, r in zip(guide, inkling.check_many([f.source for f in guide])):
        assert r["ok"] and not r["warnings"], (f.title, inkling.format_check(r))
        assert not inkling.source_problems(f.source), f.title


@needs_node
def test_make_drawing_fixes_a_bad_draft_and_drops_look_lines():
    model = FakeListChatModel(responses=[fenced(BAD), fenced("paper chalkboard\npen chalk\n" + GOOD)])
    out = asyncio.run(diagrammer.make_drawing("the agent loop", layout="cycle", model=model))
    assert out["ok"] and out["attempts"] == 2 and out["title"] == "The agent loop"
    assert "paper" not in out["source"] and "pen chalk" not in out["source"]
    assert len(out["errors"]) == 1
    assert json.loads(diagrammer.public_drawing(out)) == {"kind": "inkling", "title": "The agent loop", "source": out["source"]}


@needs_node
def test_make_drawing_gives_up_after_three_drafts():
    model = FakeListChatModel(responses=[fenced(BAD)] * diagrammer.MAX_DRAWING_ATTEMPTS)
    out = asyncio.run(diagrammer.make_drawing("the agent loop", model=model))
    assert not out["ok"] and out["attempts"] == diagrammer.MAX_DRAWING_ATTEMPTS
    assert json.loads(diagrammer.public_drawing(out))["kind"] == "none"


@needs_node
def test_a_drawing_without_steps_is_sent_back():
    nosteps = GOOD.replace("steps auto\n", "")
    model = FakeListChatModel(responses=[fenced(nosteps), fenced(GOOD)])
    out = asyncio.run(diagrammer.make_drawing("the agent loop", model=model))
    assert out["ok"] and out["attempts"] == 2 and "add steps" in out["errors"][0]


@needs_node
def test_make_drawing_tool_shape(client, course, monkeypatch):
    from app.agents import llm
    from app.agents.tutor import TOOLS, make_drawing

    assert make_drawing in TOOLS
    asked: list = []

    class Spy(FakeListChatModel):
        async def ainvoke(self, messages, *a, **k):  # type: ignore[override]
            asked.append(messages[-1].content)
            return await super().ainvoke(messages, *a, **k)

    monkeypatch.setattr(llm, "chat_model", lambda *a, **k: Spy(responses=[fenced(GOOD)]))
    rt = SimpleNamespace(state={"copilotkit": {"context": [{"description": "courseId", "value": course["id"]}]}}, context=None)
    out = json.loads(asyncio.run(make_drawing.coroutine("the agent loop", "venn", rt)))
    assert out == {"kind": "inkling", "title": "The agent loop", "source": GOOD}
    assert "Use `layout venn`." in asked[0]
