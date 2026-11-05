"""The outline review: a build that stops after its outline waits here until you approve it.

GET  /courses/{id}/plan           the outline, the chat so far, a token estimate for writing it
POST /courses/{id}/plan/chat      {message}: one model call reshapes the outline; returns the reply and the
                                  keys of the chapters that changed
POST /courses/{id}/plan/remove    {chapterKey}: drop one chapter, no model call
POST /courses/{id}/plan/approve   queue the writing job on the build's folder
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import config
from app.agents import llm
from app.api.common import get_course_summary, need_claude, not_found, ok
from app.db import db, jdump, jload, now, row, tx
from app.jobs import pipeline, store
from app.materialise import CourseOutline

log = logging.getLogger(__name__)
router = APIRouter()
HISTORY = 6  # earlier chat turns the model sees


def _load(course_id: str) -> tuple[dict, dict]:
    with db() as conn:
        c = row(conn, "SELECT id, status, brief FROM courses WHERE id=?", (course_id,))
        p = row(conn, "SELECT * FROM course_plans WHERE course_id=?", (course_id,))
    if not c:
        raise not_found("Course not found")
    if not p:
        raise not_found("This course has no outline yet")
    return dict(c), dict(p)


def _outline(p: dict) -> CourseOutline:
    return CourseOutline.model_validate(jload(p["outline"]))


def plan_out(c: dict, p: dict) -> dict:
    outline = _outline(p)
    return {
        "courseId": c["id"],
        "status": c["status"],
        "outline": outline.model_dump(by_alias=True),
        "messages": jload(p["messages"], []),
        "estimate": {"tokens": pipeline.estimate_tokens(outline)},
        "approvedAt": p["approved_at"],
    }


def _pending(c: dict, p: dict) -> None:
    if p["approved_at"]:
        raise HTTPException(status_code=409, detail="The course is already being written from this outline")


def _save(course_id: str, outline: CourseOutline, messages: list[dict], workdir: str) -> None:
    pipeline.save_outline(config.jobs_dir() / workdir, outline)
    with db() as conn:
        conn.execute(
            "UPDATE course_plans SET outline=?, messages=?, updated_at=? WHERE course_id=?",
            (outline.model_dump_json(by_alias=True), jdump(messages), now(), course_id),
        )


def changed_keys(before: CourseOutline, after: CourseOutline) -> list[str]:
    """Chapters a learner would see as new or different: a new title, or a title they haven't seen."""
    old_keys = {ch.key: ch.title for m in before.modules for ch in m.chapters}
    old_titles = set(old_keys.values())
    return [
        ch.key
        for m in after.modules
        for ch in m.chapters
        if ch.title not in old_titles or (ch.key in old_keys and old_keys[ch.key] != ch.title)
    ]


@router.get("/courses/{course_id}/plan")
def get_plan(course_id: str):
    c, p = _load(course_id)
    return ok(plan_out(c, p))


class ChatIn(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


@router.post("/courses/{course_id}/plan/chat")
async def chat(course_id: str, body: ChatIn):
    need_claude()
    c, p = await asyncio.to_thread(_load, course_id)
    _pending(c, p)
    before = _outline(p)
    messages = jload(p["messages"], [])
    history = "\n".join(f"{m['role']}: {m['text']}" for m in messages[-HISTORY:])
    user = (
        f"{pipeline.brief_text(jload(c['brief'], {}), level=False)}\n\nCurrent outline (JSON):\n"
        f"{before.model_dump_json(by_alias=True)}\n\nThe same outline, numbered as the learner sees it:\n"
        f"{pipeline.outline_text(before)}\n\n"
        + (f"Earlier in this conversation:\n{history}\n\n" if history else "")
        + f"The learner asks: {body.message.strip()}"
    )
    system = config.prompt("outline_chat") + "\n\n" + config.prompt("curriculum") + "\n\n" + config.prompt("course_format")
    tokens = 0
    try:
        out, usage = await llm.parse(system=system, user=user, schema=pipeline.OutlineChatOut, max_tokens=8000)
        tokens += usage.get("inputTokens", 0) + usage.get("outputTokens", 0)
        # Only problems this change introduced send it back: a question leaves the outline as it was.
        known = set(pipeline.outline_problems(before))
        problems = [x for x in pipeline.outline_problems(out.outline) if x not in known]
        if problems:
            retry = user + "\n\nYour previous outline had these problems. Fix every one:\n" + "\n".join(f"- {x}" for x in problems)
            out, usage = await llm.parse(system=system, user=retry, schema=pipeline.OutlineChatOut, max_tokens=8000)
            tokens += usage.get("inputTokens", 0) + usage.get("outputTokens", 0)
    except llm.MissingKey:
        raise
    except Exception as e:  # noqa: BLE001 - the outline stays as it was
        log.warning("outline chat failed for %s: %s", course_id, e)
        raise HTTPException(status_code=502, detail="The change couldn't be made, so the outline is unchanged. Try again.") from e
    after = pipeline.repair_outline(out.outline)
    changed = changed_keys(before, after)
    reply = out.reply.strip()
    count = sum(len(m.chapters) for m in after.modules)
    if count > pipeline.MAX_CHAPTERS:
        # The model's own count can be wrong; the reply says what is true.
        reply += f" The outline has {count} chapters, over the limit of {pipeline.MAX_CHAPTERS}: ask me to merge or drop some."
    at = now()
    messages += [
        {"role": "user", "text": body.message.strip(), "at": at},
        {"role": "agent", "text": reply, "at": at, "changed": changed, "tokens": tokens},
    ]
    await asyncio.to_thread(_save, course_id, after, messages, p["workdir"])
    c, p = await asyncio.to_thread(_load, course_id)
    return ok({**plan_out(c, p), "reply": reply, "changed": changed})


class RemoveIn(BaseModel):
    chapterKey: str


@router.post("/courses/{course_id}/plan/remove")
def remove(course_id: str, body: RemoveIn):
    c, p = _load(course_id)
    _pending(c, p)
    outline = _outline(p)
    module = next((m for m in outline.modules if any(ch.key == body.chapterKey for ch in m.chapters)), None)
    if module is None:
        raise not_found("That chapter isn't in the outline")
    if len(module.chapters) == 1:
        raise HTTPException(
            status_code=409,
            detail="A module keeps at least one chapter. To drop the whole module, ask for it in the chat.",
        )
    data = outline.model_dump(by_alias=True)
    for m in data["modules"]:
        m["chapters"] = [ch for ch in m["chapters"] if ch["key"] != body.chapterKey]
    after = pipeline.repair_outline(CourseOutline.model_validate(data))
    _save(course_id, after, jload(p["messages"], []), p["workdir"])
    c, p = _load(course_id)
    return ok(plan_out(c, p))


@router.post("/courses/{course_id}/plan/approve")
def approve(course_id: str):
    c, p = _load(course_id)
    _pending(c, p)
    outline = _outline(p)
    pipeline.save_outline(config.jobs_dir() / p["workdir"], outline)
    brief = jload(c["brief"], {})
    with db() as conn, tx(conn):
        conn.execute("UPDATE course_plans SET approved_at=?, updated_at=? WHERE course_id=?", (now(), now(), course_id))
        job_id = store.create_job(conn, "build_course", {"brief": brief, "workdir": p["workdir"]}, course_id=course_id)
        conn.execute("UPDATE courses SET status='building', job_id=? WHERE id=?", (job_id, course_id))
    store.emit(
        job_id, "chapters", "Writing the course from your outline",
        {"modules": [m.title for m in outline.modules], "done": 0, "total": sum(len(m.chapters) for m in outline.modules)},
    )
    with db() as conn:
        return ok({"course": get_course_summary(conn, course_id), "jobId": job_id})
