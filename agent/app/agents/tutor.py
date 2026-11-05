"""Tutor: a deep agent served over AG-UI at POST /agents/tutor.

Wiring (read from the installed packages):
- `copilotkit.LangGraphAGUIAgent` (subclass of `ag_ui_langgraph.LangGraphAgent`) copies AG-UI
  `RunAgentInput.tools` (frontend tools) and `.context` (readable context) into graph state under
  `state["copilotkit"] = {"actions": [...], "context": [{"description", "value"}, ...]}` and also into the
  runtime context for subgraphs.
- `copilotkit.CopilotKitMiddleware` (passed as deepagents middleware) appends the context to the system
  prompt as "App Context: ..." on every model call, merges the frontend tools into the model's tool list,
  and in `after_model` intercepts calls to them so they are returned to the browser instead of executed.
- `ag_ui_langgraph.add_langgraph_fastapi_endpoint(app, agent, "/agents/tutor")` mounts it.
- Conversation state: `AsyncSqliteSaver` on the same SQLite file, one thread per conversation.
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any, Literal

from langchain.tools import ToolRuntime
from langchain_core.tools import tool

from app import config
from app.agents.llm import chat_model
from app.db import db, row, rows
from app.rag.search import hybrid_search

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
CONTEXT_KEYS = ("courseId", "chapterId", "selection", "noteId")


def frontend_context(runtime: ToolRuntime | None) -> dict[str, Any]:
    """Collect courseId/chapterId/selection/noteId from CopilotKit context items.

    Accepts either one item per key (`description: "chapterId"`, `value: "<id>"`) or an item whose value is a
    JSON object holding several keys (`useCopilotReadable({description: "App state", value: {...}})`).
    """
    out: dict[str, Any] = {}
    if runtime is None:
        return out
    carriers: list[Any] = []
    state = getattr(runtime, "state", None) or {}
    carriers.append((state.get("copilotkit") or {}).get("context"))
    carriers.append((state.get("ag-ui") or {}).get("context"))
    ctx = getattr(runtime, "context", None)
    if isinstance(ctx, dict):
        carriers.append((ctx.get("copilotkit") or {}).get("context"))
        for k in CONTEXT_KEYS:
            if ctx.get(k):
                out.setdefault(k, ctx[k])
    for items in carriers:
        for item in items or []:
            if hasattr(item, "model_dump"):
                item = item.model_dump()
            if not isinstance(item, dict):
                continue
            desc, value = str(item.get("description") or ""), item.get("value")
            if isinstance(value, str):
                try:
                    parsed = json.loads(value)
                    value = parsed if isinstance(parsed, (dict, str)) else value
                except (TypeError, ValueError):
                    pass
            if isinstance(value, dict):
                for k in CONTEXT_KEYS:
                    if value.get(k):
                        out.setdefault(k, value[k])
            for k in CONTEXT_KEYS:
                if desc.strip().lower() == k.lower() or desc.strip().lower().startswith(k.lower() + ":"):
                    if value not in (None, "", {}):
                        out.setdefault(k, value)
    return out


@tool
async def search_course(
    query: str,
    scope: Literal["chapter", "course", "all"] = "course",
    runtime: ToolRuntime = None,  # type: ignore[assignment]
) -> str:
    """Search the learner's course material (chapters and notes) with hybrid retrieval.

    Args:
        query: what to look for, in natural language.
        scope: "chapter" = the open chapter, "course" = the open course, "all" = every course and note.
    Returns numbered passages; cite them in your answer as [n].
    """
    ctx = frontend_context(runtime)
    course_id = ctx.get("courseId") if scope in ("chapter", "course") else None
    chapter_id = ctx.get("chapterId") if scope == "chapter" else None
    hits = await hybrid_search(query, k=6, course_id=course_id, chapter_id=chapter_id)
    if not hits and (course_id or chapter_id):
        hits = await hybrid_search(query, k=6)
    if not hits:
        return "No passages found. The course may not cover this."
    parts = []
    for i, h in enumerate(hits, 1):
        parts.append(
            f"[{i}] {h['title']}" + (f" §{h['anchor']}" if h["anchor"] else "")
            + f" (chunkId={h['chunkId']}, chapterId={h['chapterId']}, score={h['score']})\n"
            f"Context: {h['context']}\n{h['text']}"
        )
    return "\n\n---\n\n".join(parts)


@tool
async def read_chapter(chapter_id: str) -> str:
    """Read the full markdown of a chapter by its id (chapterIds appear in search results and App Context)."""

    def load() -> str:
        with db() as conn:
            ch = row(
                conn,
                """SELECT ch.title, ch.markdown, m.title AS module_title, c.title AS course_title FROM chapters ch
                   JOIN modules m ON m.id=ch.module_id JOIN courses c ON c.id=ch.course_id WHERE ch.id=?""",
                (chapter_id.strip(),),
            )
        if not ch:
            return f"No chapter with id {chapter_id}."
        return f"Course: {ch['course_title']} / Module: {ch['module_title']}\n\n{ch['markdown'][:24000]}"

    return await asyncio.to_thread(load)


@tool
async def read_notes(query: str) -> str:
    """Read the learner's notes. Pass a note id to read that page, or a search query to find relevant notes."""
    q = query.strip()
    if UUID.match(q):

        def load() -> str:
            with db() as conn:
                n = row(conn, "SELECT title, markdown FROM note_pages WHERE id=? AND trashed_at IS NULL", (q,))
            return f"# {n['title']}\n\n{n['markdown'][:16000]}" if n else f"No note with id {q}."

        return await asyncio.to_thread(load)
    hits = await hybrid_search(q, k=5, kinds=["note"])
    if not hits:
        return "No matching notes."
    return "\n\n---\n\n".join(f"Note: {h['title']} (sourceId={h['sourceId']})\n{h['text']}" for h in hits)


@tool
async def get_progress(course_id: str) -> str:
    """The learner's progress in a course: finished chapters, quiz results and weak spots (concepts with
    repeated wrong answers). Use it to pitch an answer."""
    from app.api.common import weak_spots

    def load() -> str:
        with db() as conn:
            c = row(conn, "SELECT title FROM courses WHERE id=?", (course_id.strip(),))
            if not c:
                return f"No course with id {course_id}."
            chs = rows(
                conn,
                """SELECT ch.id, ch.title, pr.started_at, pr.finished_at FROM chapters ch JOIN modules m ON m.id=ch.module_id
                   LEFT JOIN progress pr ON pr.chapter_id=ch.id WHERE ch.course_id=? ORDER BY m.position, ch.position""",
                (course_id,),
            )
            quiz = row(
                conn,
                """SELECT COUNT(*) AS n, COALESCE(SUM(a.correct),0) AS right FROM attempts a
                   JOIN questions q ON q.id=a.question_id JOIN chapters ch ON ch.id=q.chapter_id WHERE ch.course_id=?""",
                (course_id,),
            )
            weak = weak_spots(conn, course_id)
        lines = [f"Course: {c['title']}", "Chapters:"]
        for ch in chs:
            state = "finished" if ch["finished_at"] else ("started" if ch["started_at"] else "not started")
            lines.append(f"- {ch['title']} ({ch['id']}): {state}")
        lines.append(f"Quiz attempts: {quiz['n']}, correct: {quiz['right']}")
        lines.append(
            "Weak spots: " + (", ".join(f"{w['name']} ({w['wrong']} wrong)" for w in weak) if weak else "none")
        )
        return "\n".join(lines)

    return await asyncio.to_thread(load)


TOOLS = [search_course, read_chapter, read_notes, get_progress]


def build_tutor_graph(checkpointer=None):
    from copilotkit import CopilotKitMiddleware
    from deepagents import create_deep_agent

    return create_deep_agent(
        model=chat_model("medium", max_tokens=8000),
        tools=TOOLS,
        system_prompt=config.prompt("tutor"),
        middleware=[CopilotKitMiddleware()],
        checkpointer=checkpointer,
        name="tutor",
    )


class LazyAgent:
    """Stands in for the LangGraphAGUIAgent until lifespan builds it (the AsyncSqliteSaver needs a running
    loop). `add_langgraph_fastapi_endpoint` only uses `.name` and `.clone()`."""

    name = "tutor"

    def __init__(self) -> None:
        self.agent = None

    def clone(self):
        if self.agent is None:
            raise RuntimeError("tutor agent is not ready")
        return self.agent.clone()


tutor_agent = LazyAgent()


async def init_tutor(checkpointer) -> None:
    from copilotkit import LangGraphAGUIAgent

    tutor_agent.agent = LangGraphAGUIAgent(
        name="tutor",
        description="Answers questions from the learner's courses and notes, with citations.",
        graph=build_tutor_graph(checkpointer),
    )
