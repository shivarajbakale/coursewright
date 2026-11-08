"""Diagrammer: Flowmovie for processes and protocols, Mermaid otherwise, and only checked movies are kept.

- `make_movie(spec)`: a deterministic loop for one movie (the course pipeline and the tutor's `make_flow`):
  ask the model for a `.flow`, check it, feed the errors back, at most MAX_FLOW_ATTEMPTS tries, then ask for
  Mermaid. The result carries the tokens it spent.
- `make_mermaid(spec)`: one Mermaid diagram for a static structure, with one retry if it doesn't parse.
- `DiagramSaver` writes `<course>/diagrams/<chapterKey>.flow|.mmd`, checking a movie again before it lands.
"""

from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path
from typing import Any

from langchain_core.tools import tool

from app import config, flowmovie

MAX_FLOW_ATTEMPTS = 4
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
    # Drafts are internal: inside the tutor's make_flow tool, keep them out of the AG-UI chat stream
    # (ag_ui_langgraph skips model events whose metadata says emit-messages False).
    model = model.with_config(metadata={"emit-messages": False, "emit-tool-calls": False})
    ask = (
        f"Draw this as a Flowmovie:\n\n{spec.strip()}\n"
        + (f"\nWhat the course says about it (use its names and numbers):\n{context.strip()}\n" if context.strip() else "")
        + "\nReply with only the .flow source in one ```flow fenced block. Start it with a `title` line."
    )
    messages: list = [SystemMessage(content=config.prompt("diagrammer")), HumanMessage(content=ask)]
    errors: list[str] = []
    usage = {"inputTokens": 0, "outputTokens": 0}

    def count(reply) -> None:
        u = getattr(reply, "usage_metadata", None) or {}
        usage["inputTokens"] += int(u.get("input_tokens") or 0)
        usage["outputTokens"] += int(u.get("output_tokens") or 0)

    for attempt in range(1, max_tries + 1):
        reply = await model.ainvoke(messages)
        count(reply)
        source = extract_source(_text(reply))
        result = await asyncio.to_thread(flowmovie.check, source)
        if result["ok"]:
            return {
                "kind": "flow",
                "title": flowmovie.flow_title(source) or spec.strip().splitlines()[0][:80],
                "source": source,
                "attempts": attempt,
                "errors": errors,
                "usage": usage,
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
    count(reply)
    source = extract_source(_text(reply))
    title = flowmovie.mermaid_title(source) or spec.strip().splitlines()[0][:80]
    return {
        "kind": "mermaid",
        "title": title,
        "source": with_mermaid_title(source, title),
        "attempts": max_tries,
        "errors": errors,
        "usage": usage,
    }


async def make_mermaid(spec: str, *, model=None, context: str = "") -> dict:
    """One Mermaid diagram for a static structure; one retry when it doesn't parse."""
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

    if model is None:
        from app.agents.llm import chat_model

        model = chat_model("low", max_tokens=4000)
    ask = (
        f"Draw this as a Mermaid diagram (flowchart for a structure, sequenceDiagram for messages between "
        f"parties):\n\n{spec.strip()}\n"
        + (f"\nWhat the course says about it (use its names and numbers):\n{context.strip()}\n" if context.strip() else "")
        + "\nStart with a line `%% title: <title>` and reply with only the source in one ```mermaid block."
    )
    messages: list = [SystemMessage(content=config.prompt("diagrammer")), HumanMessage(content=ask)]
    usage = {"inputTokens": 0, "outputTokens": 0}
    source = ""
    for _ in range(2):
        reply = await model.ainvoke(messages)
        u = getattr(reply, "usage_metadata", None) or {}
        usage["inputTokens"] += int(u.get("input_tokens") or 0)
        usage["outputTokens"] += int(u.get("output_tokens") or 0)
        source = extract_source(_text(reply))
        problem = flowmovie.mermaid_problem(source)
        if not problem:
            break
        messages += [
            reply if isinstance(reply, AIMessage) else AIMessage(content=_text(reply)),
            HumanMessage(content=f"That doesn't parse: {problem}. Reply with the corrected source in one ```mermaid block."),
        ]
    title = flowmovie.mermaid_title(source) or spec.strip().splitlines()[0][:80]
    return {"kind": "mermaid", "title": title, "source": with_mermaid_title(source, title), "usage": usage}


def public(result: dict) -> str:
    return json.dumps({"kind": result["kind"], "title": result["title"], "source": result["source"]})


# ---- one Inkling drawing, deterministic loop ------------------------------------------------------

MAX_DRAWING_ATTEMPTS = 3
_INKLING_FENCE = re.compile(r"```[ \t]*(?:inkling)?[ \t]*\n(.*?)```", re.S)
_LOOK = re.compile(r"^\s*(paper|pen|hand|mess|seed)\b.*$\n?", re.M)


def extract_inkling(reply: str) -> str:
    """The drawing in a reply, without the look lines: the app picks paper and pen from the reader's theme."""
    m = _INKLING_FENCE.search(reply)
    return _LOOK.sub("", (m.group(1) if m else reply)).strip() + "\n"


def drawing_problems(source: str) -> list[str]:
    """Every reason not to show a drawing: checker errors and warnings, and the house rules."""
    from app import inkling

    result = inkling.check(source)
    lines = [ln for ln in inkling.format_check(result).splitlines()[1:]]
    return lines + inkling.source_problems(source)


async def make_drawing(spec: str, *, layout: str = "", model=None, max_tries: int = MAX_DRAWING_ATTEMPTS,
                       context: str = "") -> dict:
    """Returns {"kind": "inkling", "ok", "title", "source", "attempts", "errors", "usage"}. `ok` is True when
    the source passed the checker and the house rules; otherwise the source is the last draft."""
    from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

    from app import inkling

    if model is None:
        from app.agents.llm import chat_model

        model = chat_model("low", max_tokens=6000)
    model = model.with_config(metadata={"emit-messages": False, "emit-tool-calls": False})
    want = f"\nUse `layout {layout}`.\n" if layout in inkling.LAYOUTS else ""
    ask = (
        f"Draw this as an Inkling diagram:\n\n{spec.strip()}\n{want}"
        + (f"\nWhat the course says about it (use its names and numbers):\n{context.strip()}\n" if context.strip() else "")
        + "\nReply with only the source in one ```inkling fenced block. Start it with a `title` line."
    )
    messages: list = [SystemMessage(content=config.prompt("drawing")), HumanMessage(content=ask)]
    errors: list[str] = []
    usage = {"inputTokens": 0, "outputTokens": 0}
    source = ""
    for attempt in range(1, max_tries + 1):
        reply = await model.ainvoke(messages)
        u = getattr(reply, "usage_metadata", None) or {}
        usage["inputTokens"] += int(u.get("input_tokens") or 0)
        usage["outputTokens"] += int(u.get("output_tokens") or 0)
        source = extract_inkling(_text(reply))
        problems = await asyncio.to_thread(drawing_problems, source)
        if not problems:
            return {"kind": "inkling", "ok": True, "title": inkling.title(source) or spec.strip().splitlines()[0][:80],
                    "source": source, "attempts": attempt, "errors": errors, "usage": usage}
        report = "\n".join(problems)
        errors.append(report)
        messages += [
            reply if isinstance(reply, AIMessage) else AIMessage(content=_text(reply)),
            HumanMessage(content=f"The checker says:\n{report}\n\nFix every line and reply with the whole corrected "
                         "source in one ```inkling block."),
        ]
    return {"kind": "inkling", "ok": False, "title": inkling.title(source) or spec.strip().splitlines()[0][:80],
            "source": source, "attempts": max_tries, "errors": errors, "usage": usage}


def public_drawing(result: dict) -> str:
    if not result["ok"]:
        return json.dumps({"kind": "none", "title": result["title"],
                           "note": "The drawing did not pass the checker. Explain it in words instead."})
    return json.dumps({"kind": "inkling", "title": result["title"], "source": result["source"]})
