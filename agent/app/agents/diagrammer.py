"""Diagrammer: Flowmovie for processes and protocols, Mermaid otherwise, and only checked movies are kept.

Two entry points share the same prompt (`prompts/diagrammer.md`) and the same check:
- In the course builder, a `diagrammer` subagent with the tools `flow_check`, `flow_story` and
  `save_diagram`. `save_diagram` re-checks a movie before writing `/course/diagrams/<chapterKey>.flow`, counts
  failed attempts per chapter and, after three, accepts only Mermaid (`.mmd`). The fallback is enforced in
  code, not only in the prompt.
- `make_movie(spec)`: a deterministic loop for one movie (used by the tutor's `make_flow`): ask the model for
  a `.flow`, check it, feed the errors back, at most three tries, then ask for Mermaid.
"""

from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Any, Literal

from langchain_core.tools import tool

from app import config, flowmovie

MAX_FLOW_ATTEMPTS = 3
KEY = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
_FENCE = re.compile(r"```[ \t]*(?:flow|flowmovie|mermaid|mmd)?[ \t]*\n(.*?)```", re.S)


def _text(msg: Any) -> str:
    t = getattr(msg, "text", None)
    if isinstance(t, str):
        return t
    content = getattr(msg, "content", msg)
    if isinstance(content, str):
        return content
    return "".join(b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text")


def extract_source(reply: str) -> str:
    m = _FENCE.search(reply)
    return (m.group(1) if m else reply).strip() + "\n"


def with_flow_title(source: str, title: str) -> str:
    if flowmovie.flow_title(source) or not title:
        return source
    return f"title {title}\n\n{source}"


def with_mermaid_title(source: str, title: str) -> str:
    if flowmovie.mermaid_title(source) or not title:
        return source
    return f"%% title: {title}\n{source}"


# ---- tools ----------------------------------------------------------------------------------------


@tool
async def flow_check(source: str) -> str:
    """Check a Flowmovie (.flow) script with the Flowmovie compiler. Returns OK or FAILED with every error
    and storytelling warning against its line number. Fix every error and run it again."""
    return flowmovie.format_check(await asyncio.to_thread(flowmovie.check, source))


@tool
async def flow_story(source: str) -> str:
    """Read a Flowmovie (.flow) script back as a storyboard: each scene's caption, its events in time order,
    and where every token is when the scene ends. Use it to confirm the movie tells the intended story."""
    return await asyncio.to_thread(flowmovie.story, source)


class DiagramSaver:
    """Writes `<course_dir>/diagrams/<chapterKey>.flow|.mmd`, enforcing the check and the 3-attempt fallback."""

    def __init__(self, course_dir: Path) -> None:
        self.dir = Path(course_dir) / "diagrams"
        self.failed: dict[str, int] = {}

    def save(self, chapter_key: str, kind: str, title: str, source: str) -> str:
        key = chapter_key.strip()
        if not KEY.match(key):
            return f"Refused: chapter_key must match {KEY.pattern}."
        if not source.strip():
            return "Refused: source is empty."
        self.dir.mkdir(parents=True, exist_ok=True)
        if kind == "flow":
            if self.failed.get(key, 0) >= MAX_FLOW_ATTEMPTS:
                return (
                    f"Refused: {MAX_FLOW_ATTEMPTS} Flowmovie attempts for {key} already failed. Draw the same idea in "
                    "Mermaid and save it with kind='mermaid'."
                )
            source = with_flow_title(source, title)
            result = flowmovie.check(source)
            if not result["ok"]:
                self.failed[key] = self.failed.get(key, 0) + 1
                left = MAX_FLOW_ATTEMPTS - self.failed[key]
                tail = (
                    f"{left} attempt(s) left; fix the errors and save again."
                    if left
                    else "No attempts left: draw it in Mermaid and save with kind='mermaid'."
                )
                return "Not saved, the movie does not compile.\n" + flowmovie.format_check(result) + "\n" + tail
            (self.dir / f"{key}.flow").write_text(source)
            (self.dir / f"{key}.mmd").unlink(missing_ok=True)
            warn = f" ({len(result['warnings'])} warning(s) kept)" if result["warnings"] else ""
            return f"Saved /course/diagrams/{key}.flow{warn}."
        if kind == "mermaid":
            problem = flowmovie.mermaid_problem(source)
            if problem:
                return f"Not saved: {problem}"
            (self.dir / f"{key}.mmd").write_text(with_mermaid_title(source, title))
            (self.dir / f"{key}.flow").unlink(missing_ok=True)
            return f"Saved /course/diagrams/{key}.mmd."
        return "Refused: kind must be 'flow' or 'mermaid'."


def builder_tools(course_dir: Path) -> list:
    saver = DiagramSaver(course_dir)

    @tool
    async def save_diagram(chapter_key: str, kind: Literal["flow", "mermaid"], title: str, source: str) -> str:
        """Save a chapter's diagram. kind='flow' saves /course/diagrams/<chapter_key>.flow only if the movie
        compiles (it is checked again here); after 3 failed movies for a chapter only kind='mermaid' is
        accepted. kind='mermaid' saves /course/diagrams/<chapter_key>.mmd. Saving one kind replaces the other."""
        return await asyncio.to_thread(saver.save, chapter_key, kind, title, source)

    return [flow_check, flow_story, save_diagram]


def subagent_spec(course_dir: Path, model) -> dict:
    return {
        "name": "diagrammer",
        "description": "Draws the diagrams that chapters request (diagramRequest in /course/chapters/<key>.json): "
        "a checked Flowmovie for processes and protocols, Mermaid otherwise. Give it the chapter keys to draw. "
        "It saves /course/diagrams/<chapterKey>.flow or .mmd.",
        "system_prompt": config.prompt("diagrammer") + "\n\n" + config.prompt("diagrammer_builder"),
        "model": model,
        "tools": builder_tools(course_dir),
    }


def validate_course_diagrams(course_dir: Path) -> list[str]:
    """Final gate before materialise: a `.flow` that doesn't compile is moved aside (never saved to the DB).
    Returns the chapter keys whose movie was rejected."""
    rejected = []
    d = Path(course_dir) / "diagrams"
    for f in sorted(d.glob("*.flow")) if d.exists() else []:
        if not flowmovie.check(f.read_text())["ok"]:
            f.rename(f.with_suffix(".flow.rejected"))
            rejected.append(f.stem)
    return rejected


# ---- one movie, deterministic loop ----------------------------------------------------------------


async def make_movie(spec: str, *, model=None, max_tries: int = MAX_FLOW_ATTEMPTS, context: str = "") -> dict:
    """Returns {"kind": "flow"|"mermaid", "title", "source", "attempts", "errors"}; the flow source is checked."""
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

    if model is None:
        from app.agents.llm import chat_model

        model = chat_model("medium", max_tokens=16000)
    ask = (
        f"Draw this as a Flowmovie:\n\n{spec.strip()}\n"
        + (f"\nWhat the course says about it (use its names and numbers):\n{context.strip()}\n" if context.strip() else "")
        + "\nReply with only the .flow source in one ```flow fenced block. Start it with a `title` line."
    )
    messages: list = [SystemMessage(content=config.prompt("diagrammer")), HumanMessage(content=ask)]
    errors: list[str] = []
    for attempt in range(1, max_tries + 1):
        reply = await model.ainvoke(messages)
        source = extract_source(_text(reply))
        result = await asyncio.to_thread(flowmovie.check, source)
        if result["ok"]:
            return {
                "kind": "flow",
                "title": flowmovie.flow_title(source) or spec.strip().splitlines()[0][:80],
                "source": source,
                "attempts": attempt,
                "errors": errors,
            }
        report = flowmovie.format_check(result)
        errors.append(report)
        messages += [
            reply if isinstance(reply, AIMessage) else AIMessage(content=_text(reply)),
            HumanMessage(content=f"flow_check says:\n{report}\n\nFix every error and reply with the whole corrected "
                         "script in one ```flow block."),
        ]
    messages.append(
        HumanMessage(
            content="That movie still doesn't compile, so give up on Flowmovie. Draw the same idea as a Mermaid "
            "diagram (sequenceDiagram for messages between parties, flowchart otherwise). Start with a line "
            "`%% title: <title>` and reply with only the source in one ```mermaid block."
        )
    )
    reply = await model.ainvoke(messages)
    source = extract_source(_text(reply))
    title = flowmovie.mermaid_title(source) or spec.strip().splitlines()[0][:80]
    return {
        "kind": "mermaid",
        "title": title,
        "source": with_mermaid_title(source, title),
        "attempts": max_tries,
        "errors": errors,
    }


def public(result: dict) -> str:
    return json.dumps({"kind": result["kind"], "title": result["title"], "source": result["source"]})
