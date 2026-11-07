from __future__ import annotations

from fastapi import APIRouter, Header
from pydantic import BaseModel

from app.api.common import chapter_out, not_found, ok
from app.db import db, new_id, now, row, tx

router = APIRouter()


@router.get("/chapters/{chapter_id}")
def get_chapter(chapter_id: str, x_cw_prefetch: str | None = Header(default=None)):
    """A chapter. Opening it makes it the course's last opened chapter, except for a prefetch (the reader
    saving a course for offline sends `X-CW-Prefetch: 1`), which must not move the Continue card."""
    with db() as conn:
        ch = chapter_out(conn, chapter_id)
        if not ch:
            raise not_found("Chapter not found")
        if not x_cw_prefetch:
            conn.execute("UPDATE courses SET last_opened_chapter_id=? WHERE id=?", (chapter_id, ch["courseId"]))
    return ok(ch)


class ProgressIn(BaseModel):
    finished: bool = False


@router.post("/chapters/{chapter_id}/progress")
def set_progress(chapter_id: str, body: ProgressIn):
    with db() as conn, tx(conn):
        if not row(conn, "SELECT 1 FROM chapters WHERE id=?", (chapter_id,)):
            raise not_found("Chapter not found")
        t = now()
        conn.execute(
            """INSERT INTO progress(chapter_id, started_at, finished_at) VALUES (?,?,?)
               ON CONFLICT(chapter_id) DO UPDATE SET started_at=COALESCE(progress.started_at, excluded.started_at),
                 finished_at=excluded.finished_at""",
            (chapter_id, t, t if body.finished else None),
        )
        p = row(conn, "SELECT started_at, finished_at FROM progress WHERE chapter_id=?", (chapter_id,))
    return ok({"startedAt": p["started_at"], "finishedAt": p["finished_at"]})


class AttemptIn(BaseModel):
    chosen: int


@router.post("/questions/{question_id}/attempts")
def attempt(question_id: str, body: AttemptIn):
    with db() as conn:
        q = row(conn, "SELECT answer, explanation FROM questions WHERE id=?", (question_id,))
        if not q:
            raise not_found("Question not found")
        correct = body.chosen == q["answer"]
        conn.execute(
            "INSERT INTO attempts(id, question_id, chosen, correct, at) VALUES (?,?,?,?,?)",
            (new_id(), question_id, body.chosen, int(correct), now()),
        )
    return ok({"correct": correct, "answer": q["answer"], "explanation": q["explanation"]})


class _Questions(BaseModel):
    questions: list[dict]


@router.post("/chapters/{chapter_id}/questions", status_code=201)
async def write_questions(chapter_id: str):
    """Write 3 check-yourself questions for a lesson that has none (a build that came back without them).
    A lesson that already has questions is left alone: answers point at them."""
    import asyncio

    from fastapi import HTTPException

    from app import config, inkling
    from app.agents import llm
    from app.db import jdump
    from app.materialise import QuestionSpec

    def load():
        with db() as conn:
            ch = row(conn, "SELECT id, title, markdown FROM chapters WHERE id=?", (chapter_id,))
            n = conn.execute("SELECT COUNT(*) FROM questions WHERE chapter_id=?", (chapter_id,)).fetchone()[0]
        return ch, n

    ch, have = await asyncio.to_thread(load)
    if not ch:
        raise not_found("Chapter not found")
    if have:
        raise HTTPException(status_code=409, detail="This lesson already has questions")
    text = inkling.strip_fences(ch["markdown"], keep_title=False)
    user = (f"Passage 1 (the lesson \"{ch['title']}\"):\n{text}\n\nWrite 3 questions as `questions`, each "
            "{prompt, options, answer, explanation}.")
    good: list[QuestionSpec] = []
    for _ in range(2):
        out, _usage = await llm.parse(system=config.prompt("quiz") + "\n\n" + config.prompt("course_format"),
                                      user=user, schema=_Questions, max_tokens=6000)
        good = []
        for q in out.questions:
            try:
                good.append(QuestionSpec.model_validate({k: q.get(k) for k in ("prompt", "options", "answer", "explanation") if k in q}))
            except Exception:  # noqa: BLE001 - a malformed question is dropped
                continue
        if len(good) >= 2:
            break
    if len(good) < 2:
        raise HTTPException(status_code=502, detail="Couldn't write questions for this lesson. Try again.")

    def save():
        with db() as conn, tx(conn):
            for pos, q in enumerate(good[:3]):
                conn.execute(
                    """INSERT INTO questions(id, chapter_id, position, prompt, options, answer, explanation, concept_ids)
                       VALUES (?,?,?,?,?,?,?, '[]')""",
                    (new_id(), chapter_id, pos, q.prompt, jdump(q.options), q.answer, q.explanation),
                )

    await asyncio.to_thread(save)
    with db() as conn:
        return ok(chapter_out(conn, chapter_id))
