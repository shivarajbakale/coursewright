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

from langchain.agents.middleware import AgentMiddleware, ModelRequest
from langchain.tools import ToolRuntime
from langchain_core.tools import tool
from pydantic import BaseModel

from app import config
from app.agents.llm import chat_model
from app.db import db, row, rows
from app.rag.search import hybrid_search

UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
CONTEXT_KEYS = ("courseId", "chapterId", "selection", "noteId", "webSearch")
WEB_SEARCH_TOOL = {"type": "web_search_20260209", "name": "web_search", "max_uses": 3}


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


def search_hits_json(query: str, hits: list[dict]) -> str:
    """The search_course result: numbered hits the model cites as [n] and the UI renders as citations."""
    out: dict[str, Any] = {
        "query": query,
        "hits": [
            {
                "n": i,
                "chunkId": h["chunkId"],
                "title": h["title"],
                "chapterId": h.get("chapterId"),
                "courseId": h.get("courseId"),
                "text": h["text"],
            }
            for i, h in enumerate(hits, 1)
        ],
    }
    if not hits:
        out["note"] = "No passages found. The course may not cover this."
    return json.dumps(out, ensure_ascii=False)


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
    Returns JSON {"query", "hits": [{"n", "chunkId", "title", "chapterId", "courseId", "text"}]}. Cite a hit
    in your answer as [n] using its "n".
    """
    ctx = frontend_context(runtime)
    course_id = ctx.get("courseId") if scope in ("chapter", "course") else None
    chapter_id = ctx.get("chapterId") if scope == "chapter" else None
    hits = await hybrid_search(query, k=6, course_id=course_id, chapter_id=chapter_id)
    if not hits and (course_id or chapter_id):
        hits = await hybrid_search(query, k=6)
    return search_hits_json(query, hits)


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


@tool
async def make_flow(
    spec: str,
    runtime: ToolRuntime = None,  # type: ignore[assignment]
) -> str:
    """Make an animated, step-by-step movie (Flowmovie) of a process or protocol for the chat to play.

    Args:
        spec: what the movie should show: the actors, the steps in order, the numbers, and the one point it
            makes. Use the course's names and examples.
    Returns JSON {"kind": "flow"|"mermaid", "title", "source"}: a Flowmovie that passed the checker, or a
    Mermaid diagram when three movie attempts failed. The app renders it; don't paste the source in your reply.
    """
    from app.agents import diagrammer

    ctx = frontend_context(runtime)
    hits = await hybrid_search(spec, k=4, course_id=ctx.get("courseId"))
    context = "\n\n".join(f"{h['title']}: {h['text'][:1200]}" for h in hits)
    return diagrammer.public(await diagrammer.make_movie(spec, context=context))


class QuizDraftQuestion(BaseModel):
    prompt: str
    options: list[str]
    answer: int
    explanation: str
    passage: int


class QuizDraft(BaseModel):
    questions: list[QuizDraftQuestion]


def _chapter_passages(chapter_id: str) -> list[dict]:
    with db() as conn:
        rs = rows(
            conn,
            "SELECT id, title, text, course_id, chapter_id FROM chunks WHERE chapter_id=? ORDER BY position LIMIT 12",
            (chapter_id,),
        )
    return [
        {"chunkId": r["id"], "title": r["title"], "text": r["text"], "courseId": r["course_id"], "chapterId": r["chapter_id"]}
        for r in rs
    ]


def clean_quiz(draft: QuizDraft, passages: list[dict], n: int) -> dict:
    """Keep well-formed questions only: 2-6 distinct options, answer in range; chapterId from the passage."""
    out = []
    for q in draft.questions:
        opts = [o.strip() for o in q.options if o.strip()]
        if not q.prompt.strip() or not 2 <= len(opts) <= 6 or len({o.lower() for o in opts}) != len(opts):
            continue
        if not 0 <= q.answer < len(opts):
            continue
        src = passages[q.passage - 1] if 1 <= q.passage <= len(passages) else passages[0]
        out.append(
            {
                "prompt": q.prompt.strip(),
                "options": opts,
                "answer": q.answer,
                "explanation": q.explanation.strip(),
                "chapterId": src.get("chapterId"),
            }
        )
        if len(out) >= n:
            break
    return {"questions": out}


@tool
async def make_quiz(
    concept_or_chapter: str,
    n: int = 4,
    runtime: ToolRuntime = None,  # type: ignore[assignment]
) -> str:
    """Write n multiple-choice questions grounded in the learner's course.

    Args:
        concept_or_chapter: a chapter id (quiz on that chapter) or a concept / topic in words.
        n: how many questions, 1-8.
    Returns JSON {"questions": [{"prompt", "options": [...], "answer": <0-based index>, "explanation",
    "chapterId"}]}. Pass it to the frontend tool `start_quiz(questionsJson)` to show it.
    """
    from app.agents import llm

    n = max(1, min(int(n or 4), 8))
    arg = concept_or_chapter.strip()
    passages = await asyncio.to_thread(_chapter_passages, arg) if UUID.match(arg) else []
    if not passages:
        ctx = frontend_context(runtime)
        passages = await hybrid_search(arg, k=8, course_id=ctx.get("courseId"))
        if not passages and ctx.get("courseId"):
            passages = await hybrid_search(arg, k=8)
    if not passages:
        return json.dumps({"questions": [], "note": "The course has nothing on this to quiz from."})
    numbered = "\n\n".join(f"[{i}] {p['title']}\n{p['text'][:2000]}" for i, p in enumerate(passages, 1))
    draft, _usage = await llm.parse(
        system=config.prompt("quiz"),
        user=f"Write {n} questions on: {arg}\n\nPassages:\n\n{numbered}",
        schema=QuizDraft,
        effort="medium",
        max_tokens=6000,
    )
    return json.dumps(clean_quiz(draft, passages, n), ensure_ascii=False)


def web_search_enabled(state: Any, context: Any) -> bool:
    from types import SimpleNamespace

    v = frontend_context(SimpleNamespace(state=state or {}, context=context)).get("webSearch")
    return v is True or (isinstance(v, str) and v.strip().lower() in ("true", "1", "yes", "on"))


class WebSearchToggle(AgentMiddleware):
    """Adds Claude's web_search server tool to a model call only when the frontend context says
    `webSearch: true` (bound per run, per model call; off by default)."""

    def _with_tool(self, request: ModelRequest) -> ModelRequest:
        if not config.is_anthropic() or not web_search_enabled(request.state, getattr(request.runtime, "context", None)):
            return request
        if any(isinstance(t, dict) and t.get("name") == "web_search" for t in request.tools or []):
            return request
        return request.override(tools=[*(request.tools or []), WEB_SEARCH_TOOL])

    def wrap_model_call(self, request, handler):
        return handler(self._with_tool(request))

    async def awrap_model_call(self, request, handler):
        return await handler(self._with_tool(request))


TOOLS = [search_course, read_chapter, read_notes, get_progress, make_flow, make_quiz]


def build_tutor_graph(checkpointer=None):
    from copilotkit import CopilotKitMiddleware
    from deepagents import create_deep_agent

    return create_deep_agent(
        model=chat_model("medium", max_tokens=8000),
        tools=TOOLS,
        system_prompt=config.prompt("tutor"),
        middleware=[CopilotKitMiddleware(), WebSearchToggle()],
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
