"""The accuracy pass: check a built course's lessons for mistakes again, with the current verifier, and
correct only what is wrong.

The model's arithmetic is not reliable enough to trust its corrections blindly (a trial on the quant course
fixed one Black-Scholes number and broke three others), so by default the job only PROPOSES: each
proposal is recorded with the text before and after, for a person or a careful agent to check and apply
with PATCH /chapters/:id. {"apply": true} saves corrections that pass every gate.

POST /api/courses/:id/accuracy queues it. For each lesson the verifier reads the text and its questions
VERIFY_RUNS times (it misses about one mistake in three on a single reading), and code adds any written-out
arithmetic that doesn't add up. A lesson with mistakes gets one correction call that must change only the
wrong sentences and questions. The correction is kept only when it passes the same gates as a hand edit
(title, drawings) and a fresh check finds fewer mistakes than before. Every change is recorded in the job
output with the text before and after, so it can be reviewed and reverted with PATCH /chapters/:id.
"""

from __future__ import annotations

import asyncio
import logging
import re

from pydantic import BaseModel, Field

from app import config, inkling, lessons
from app.db import db, jload, rows
from app.jobs import precision, store

log = logging.getLogger(__name__)

CONCURRENCY = 4
# A model showing its work lists checks that passed ("so 16.2% is correct"); a real mistake says what is
# wrong. One that names no fault is dropped.
FAULT = re.compile(r"\b(wrong|incorrect|should|not|isn't|doesn't|error|mistake|inconsisten\w*|contradict\w*|"
                   r"misstat\w*|invert\w*|backwards|off by|instead|never|missing|mislabel\w*|misleading)\b", re.I)


class QuestionFix(BaseModel):
    number: int = Field(description="The question's number, from 1, as listed")
    prompt: str
    options: list[str]
    answer: int = Field(description="0-based index of the right option")
    explanation: str


class Correction(BaseModel):
    markdown: str = Field(description="The whole lesson, with only the wrong parts changed")
    questions: list[QuestionFix] = Field(default_factory=list, description="Only the questions that change")


FIX = """You correct one lesson of a course. A careful checker found the mistakes listed. Fix every one of
them and change nothing else: every other sentence stays word for word, and so does every ```inkling
block, unless a number or label inside it is part of a mistake. Where a fix changes a result, also fix the
sentences that rely on it (a loss called a gain, a total, a conclusion). Keep the lesson's headings and its
`> **Key idea:**` line. If a check-yourself question or its answer key depends on a mistake, return the
corrected question; otherwise return no questions. If a listed mistake is in fact correct, leave that part
as it is."""


def _lessons(course_id: str, only: list[str] | None) -> list[dict]:
    with db() as conn:
        chs = rows(conn, """SELECT ch.id, ch.title, ch.markdown FROM chapters ch JOIN modules m ON m.id=ch.module_id
                            WHERE ch.course_id=? ORDER BY m.position, ch.position""", (course_id,))
        out = []
        for c in chs:
            if only and c["id"] not in only:
                continue
            qs = rows(conn, "SELECT id, prompt, options, answer, explanation FROM questions WHERE chapter_id=? "
                            "ORDER BY position", (c["id"],))
            out.append({**dict(c), "questions": [{**dict(q), "options": jload(q["options"], [])} for q in qs]})
    if not out and not chs:
        raise LookupError("course has no lessons")
    return out


def questions_text(qs: list[dict]) -> str:
    return "\n".join(
        f"Q{i + 1}: {q['prompt']}\n" + "\n".join(f"  [{j}] {o}" for j, o in enumerate(q["options"]))
        + f"\n  answer: {q['answer']}\n  explanation: {q['explanation']}"
        for i, q in enumerate(qs)
    )


async def find_mistakes(call, markdown: str, qs: list[dict]) -> list[str]:
    """Every mistake any of VERIFY_RUNS readings found, plus arithmetic that code shows is wrong."""
    from app.jobs.pipeline import VERIFY_RUNS, VerifyOut

    user = f"{markdown}\n\nQuestions:\n{questions_text(qs)}"
    runs = await asyncio.gather(*[call(config.prompt("verifier"), user, VerifyOut, 8000) for _ in range(VERIFY_RUNS)],
                                return_exceptions=True)
    for r in runs:
        if isinstance(r, store.Cancelled):
            raise r
    good = [r for r in runs if isinstance(r, VerifyOut)]
    if not good:
        raise RuntimeError(f"the check failed: {runs[0]}")
    found = [i for r in good for i in r.issues if FAULT.search(i)]
    found += [f"This arithmetic is wrong: {e}" for e in precision.arithmetic_errors(inkling.strip_fences(markdown))]
    return list(dict.fromkeys(found))


def correction_problems(lesson: dict, fix: Correction) -> list[str]:
    """Why a correction can't be kept, before it is checked again."""
    qs = lesson["questions"]
    edits = []
    for q in fix.questions:
        if 1 <= q.number <= len(qs):
            edits.append({"id": qs[q.number - 1]["id"], "prompt": q.prompt, "options": q.options,
                          "answer": q.answer, "explanation": q.explanation})
    out = lessons.problems(lesson["title"], fix.markdown, edits, {q["id"] for q in qs})
    if len(inkling.fences(fix.markdown)) != len(inkling.fences(lesson["markdown"])):
        out.append("The correction dropped or added a drawing")
    before, after = len(lesson["markdown"]), len(fix.markdown)
    if not 0.75 * before <= after <= 1.25 * before:
        out.append(f"The correction changed the lesson's length from {before} to {after} characters")
    return out


def _edits(lesson: dict, fix: Correction) -> list[dict]:
    qs = lesson["questions"]
    return [{"id": qs[q.number - 1]["id"], "prompt": q.prompt, "options": q.options, "answer": q.answer,
             "explanation": q.explanation} for q in fix.questions if 1 <= q.number <= len(qs)]


async def correct(call, lesson: dict, apply: bool = False) -> dict:
    """One lesson: its mistakes, and the correction if one was kept. Never raises for a model failure."""
    issues = await find_mistakes(call, lesson["markdown"], lesson["questions"])
    record = {"id": lesson["id"], "title": lesson["title"], "issues": issues, "kept": False}
    if not issues:
        return record
    user = (f"Mistakes found:\n" + "\n".join(f"- {i}" for i in issues)
            + f"\n\nThe lesson:\n\n{lesson['markdown']}\n\nIts questions:\n{questions_text(lesson['questions'])}")
    fix = await call(FIX + "\n\n" + config.prompt("course_format"), user, Correction, 12000)
    bad = await asyncio.to_thread(correction_problems, lesson, fix)
    if bad:
        record["rejected"] = bad
        return record
    edits = _edits(lesson, fix)
    by_id = {e["id"]: e for e in edits}
    after = [by_id.get(q["id"], q) for q in lesson["questions"]]
    left = await find_mistakes(call, fix.markdown, after)
    record["left"] = left
    if len(left) >= len(issues):
        record["rejected"] = [f"A fresh check found {len(left)} mistakes, the original {len(issues)}"]
        return record
    record.update(proposed=True, before={"markdown": lesson["markdown"], "questions": [
        q for q in lesson["questions"] if q["id"] in by_id]}, after={"markdown": fix.markdown, "questions": edits})
    if apply:
        record["kept"] = True
        record["sourceId"] = await asyncio.to_thread(lessons.apply, lesson["id"], fix.markdown, edits)
    return record


async def run(job: dict) -> dict:
    """Input {"courseId", "chapterIds"?, "apply"?}."""
    from app.agents import llm
    from app.jobs.pipeline import Ledger, gather_limited
    from app.rag import ingest

    job_id = job["id"]
    inp = jload(job["input"], {})
    course_id = inp.get("courseId") or job["course_id"]
    if not config.anthropic_key():
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    todo = await asyncio.to_thread(_lessons, course_id, inp.get("chapterIds"))
    apply = bool(inp.get("apply"))
    ledger = Ledger(job_id, jload(job.get("usage"), None))
    tally = {"done": 0, "withMistakes": 0, "proposed": 0, "corrected": 0, "total": len(todo)}
    records: list[dict] = []
    store.emit(job_id, "accuracy", f"Checking {len(todo)} lessons for mistakes", dict(tally))

    async def call(system: str, user: str, schema, max_tokens: int):
        parsed, usage = await llm.parse(system=system, user=user, schema=schema, effort="medium", max_tokens=max_tokens)
        ledger.add("accuracy", usage)
        await ledger.save()
        return parsed

    async def one(lesson: dict) -> None:
        try:
            rec = await correct(call, lesson, apply)
        except store.Cancelled:
            raise
        except Exception as e:  # noqa: BLE001 - one lesson failing leaves it as it was
            log.warning("accuracy check of %s failed: %s", lesson["title"], e)
            rec = {"id": lesson["id"], "title": lesson["title"], "error": str(e)[:300], "kept": False}
        records.append(rec)
        tally["done"] += 1
        tally["withMistakes"] += bool(rec.get("issues"))
        tally["corrected"] += rec["kept"]
        tally["proposed"] += bool(rec.get("proposed"))
        what = (f"Corrected {lesson['title']}" if rec["kept"] else
                f"Proposed a correction to {lesson['title']}" if rec.get("proposed") else
                f"Found mistakes in {lesson['title']}, left it as it was" if rec.get("issues") else
                f"No mistakes in {lesson['title']}")
        await asyncio.to_thread(store.emit, job_id, "accuracy", what, dict(tally))

    await gather_limited([lambda x=x: one(x) for x in todo], CONCURRENCY,
                         lambda: asyncio.to_thread(store.check_cancel, job_id))
    for rec in records:
        if rec.get("sourceId"):
            await ingest.ingest_source(rec.pop("sourceId"), force=True, llm_context=False)
    done = (f"Corrected {tally['corrected']}" if apply else f"Proposed corrections to {tally['proposed']}")
    store.emit(job_id, "done", f"{done} of {tally['withMistakes']} lessons with mistakes",
               {"courseId": course_id, **tally})
    order = {x["id"]: i for i, x in enumerate(todo)}
    records.sort(key=lambda r: order.get(r["id"], 0))
    return {"courseId": course_id, **tally, "lessons": records, "usage": ledger.usage()}
