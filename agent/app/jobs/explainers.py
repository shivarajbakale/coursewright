"""Inkling explainers: one model call per lesson picks where a drawing helps and writes it (prompts/explainer.md).

Each explainer goes into the lesson's markdown as an ```inkling fence right after the paragraph it pictures,
so the builder, an authoring agent and this backfill all produce the same thing and both apps render it
where it sits. A draft is checked by the vendored Inkling checker (app/inkling.py) and the house rules, and
revised up to twice with the problems named; a lesson whose drafts never pass keeps its text unchanged.

Used two ways:
    the build pipeline's explainers stage, on course/chapters/<key>.md before the course is saved;
    the `explainers` job (POST /api/courses/:id/explainers), on an existing course's chapters in the database,
    which then re-indexes the course for the tutor.

The layouts already chosen in the course are passed along, so a course does not settle into one template.
"""

from __future__ import annotations

import asyncio
import logging
import re
from collections import Counter
from typing import Awaitable, Callable

from pydantic import BaseModel, Field

from app import config, inkling
from app.db import db, jload, rows
from app.jobs import store

log = logging.getLogger(__name__)

REVISIONS = 2
CONCURRENCY = 4


class ExplainerSpec(BaseModel):
    after: str = Field(description="The opening words (eight or more) of the paragraph the drawing follows, copied exactly from the lesson.")
    idea: str = Field(description="One line: the idea it pictures and why this layout fits it.")
    source: str = Field(description="The Inkling source: a title line, the drawing, and its steps. No paper, pen or hand lines.")


class ExplainersOut(BaseModel):
    explainers: list[ExplainerSpec] = Field(description="One explainer, or two when the lesson has two ideas to see separately.")


Call = Callable[[str, str], Awaitable[ExplainersOut]]


# ---- placing a drawing in the text -----------------------------------------------------------------------


def _norm(s: str) -> str:
    s = re.sub(r"[*_`>#\[\]()]", "", s.lower())
    return re.sub(r"\s+", " ", s).strip()


def _blocks(markdown: str) -> list[tuple[int, int, bool]]:
    """(first line, last line, is_code) of each block between blank lines; a fenced block is one block."""
    lines = markdown.split("\n")
    out: list[tuple[int, int, bool]] = []
    start, fence = None, False
    for i, ln in enumerate(lines):
        if ln.strip().startswith("```"):
            if not fence:
                if start is not None:
                    out.append((start, i - 1, False))
                start, fence = i, True
            else:
                out.append((start, i, True))
                start, fence = None, False
            continue
        if fence:
            continue
        if not ln.strip():
            if start is not None:
                out.append((start, i - 1, False))
                start = None
        elif start is None:
            start = i
    if start is not None:
        out.append((start, len(lines) - 1, fence))
    return out


def find_paragraph(markdown: str, after: str) -> int | None:
    """The last line of the paragraph that opens with (or contains) `after`, outside code; None if none does."""
    want = _norm(after)[:80]
    if len(want) < 12:
        return None
    lines = markdown.split("\n")
    candidates = []
    for a, b, code in _blocks(markdown):
        if code:
            continue
        if lines[a].lstrip().startswith("#"):
            continue
        text = _norm(" ".join(lines[a:b + 1]))
        if text.startswith(want):
            return b
        if want in text:
            candidates.append(b)
    return candidates[0] if candidates else None


def insert(markdown: str, specs: list[ExplainerSpec]) -> tuple[str, list[str]]:
    """The lesson with each drawing after its paragraph, and the placements that could not be found."""
    lines = markdown.rstrip("\n").split("\n")
    at: dict[int, list[str]] = {}
    problems = []
    for i, s in enumerate(specs, 1):
        end = find_paragraph(markdown, s.after)
        if end is None:
            problems.append(f'explainer {i}: no paragraph opens with "{s.after[:80]}"; copy the opening words of '
                            "a paragraph exactly")
            continue
        at.setdefault(end, []).append(inkling.fence(s.source))
    out: list[str] = []
    for i, ln in enumerate(lines):
        out.append(ln)
        for f in at.get(i, []):
            out.extend(["", *f.split("\n")])
    return "\n".join(out) + "\n", problems


def problems_for(markdown: str, specs: list[ExplainerSpec]) -> tuple[str, list[str]]:
    if not specs:
        return markdown, ["no explainer: draw the lesson's main idea"]
    if len(specs) > inkling.MAX_PER_LESSON:
        specs = specs[: inkling.MAX_PER_LESSON]
    for s in specs:
        s.source = _clean(s.source)
    new, missing = insert(markdown, specs)
    return new, missing + inkling.markdown_problems(new)


_LOOK = re.compile(r"^\s*(paper|pen|hand)\s+\S+\s*$", re.M)


def _clean(source: str) -> str:
    """The app chooses the paper, pen and hand; a fence inside the source would end the lesson's fence; and
    an empty step is removed."""
    source = source.strip().removeprefix("```inkling").removesuffix("```").strip()
    source = _LOOK.sub("", source).strip()
    # A step that only names things an earlier step drew draws nothing, and Inkling drops it with its
    # caption. Models write such "now look at X" steps often; drop them here rather than fail the drawing.
    empty = set(inkling.empty_steps(source))
    if empty:
        source = "\n".join(ln for ln in source.split("\n")
                            if not ((m := re.match(r"\s*step\s+(\d+)\s*:", ln)) and int(m.group(1)) in empty))
    return source


# ---- one lesson ------------------------------------------------------------------------------------------


def prompt(*, course: str, title: str, markdown: str, layouts: Counter) -> str:
    used = ", ".join(f"{k} {v}" for k, v in layouts.most_common()) or "none yet"
    return (
        f"Course: {course}\nLesson: {title}\n\n"
        f"Layouts the course's explainers use so far: {used}. Pick from the idea; when two layouts fit "
        "equally, prefer the one the course has used less.\n\n"
        f"<lesson>\n{markdown}\n</lesson>"
    )


async def explain(call: Call, *, course: str, title: str, markdown: str, layouts: Counter) -> tuple[str | None, list[str]]:
    """The lesson with its explainers inserted, or None when no draft passed. Also returns the layouts used."""
    base = inkling.strip_fences(markdown, keep_title=False) if inkling.fences(markdown) else markdown
    user = prompt(course=course, title=title, markdown=base, layouts=layouts)
    out = await call(SYSTEM(), user)
    new, found = problems_for(base, out.explainers)
    for _ in range(REVISIONS):
        if not found:
            break
        draft = "\n\n".join(f"after: {s.after}\n```inkling\n{s.source}\n```" for s in out.explainers)
        retry = (f"{user}\n\nYour previous draft:\n{draft}\n\nRevise it to fix these problems, keeping "
                 "everything else:\n" + "\n".join(f"- {p}" for p in found))
        out = await call(SYSTEM(), retry)
        new, found = problems_for(base, out.explainers)
    if found:
        log.info("explainers for %s not added: %s", title, found)
        return None, []
    return new, [inkling.layout(s.source) for s in out.explainers[: inkling.MAX_PER_LESSON]]


def SYSTEM() -> str:  # noqa: N802 - read once per call so a prompt edit needs no restart
    return config.prompt("explainer") + "\n\n" + config.prompt("course_format")


# ---- the backfill job ------------------------------------------------------------------------------------


def _chapters(course_id: str, only: list[str] | None) -> tuple[str, list[dict]]:
    with db() as conn:
        c = rows(conn, "SELECT title FROM courses WHERE id=?", (course_id,))
        if not c:
            raise LookupError("course not found")
        chs = rows(
            conn,
            """SELECT ch.id, ch.title, ch.markdown FROM chapters ch JOIN modules m ON m.id=ch.module_id
               WHERE ch.course_id=? ORDER BY m.position, ch.position""",
            (course_id,),
        )
    out = [dict(r) for r in chs if not only or r["id"] in only]
    return c[0]["title"], out


def _save(chapter_id: str, markdown: str) -> None:
    with db() as conn:
        conn.execute("UPDATE chapters SET markdown=? WHERE id=?", (markdown, chapter_id))


async def run(job: dict) -> dict:
    """Input {"courseId", "chapterIds"?, "redo"?}. Lessons that already have explainers are skipped unless redo."""
    from app.agents import llm
    from app.jobs.pipeline import Ledger, gather_limited
    from app.rag import ingest

    job_id = job["id"]
    inp = jload(job["input"], {})
    course_id = inp.get("courseId") or job["course_id"]
    if not config.anthropic_key():
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    course, chapters = await asyncio.to_thread(_chapters, course_id, inp.get("chapterIds"))
    redo = bool(inp.get("redo"))
    layouts: Counter = Counter()
    for ch in chapters:
        for f in inkling.fences(ch["markdown"]):
            layouts[f.layout] += 1
    todo = [ch for ch in chapters if redo or not inkling.fences(ch["markdown"])]
    ledger = Ledger(job_id, jload(job.get("usage"), None))
    tally = {"done": len(chapters) - len(todo), "added": 0, "skipped": 0, "total": len(chapters)}
    store.emit(job_id, "explainers", f"Drawing explainers for {len(todo)} chapters", dict(tally))

    async def call(system: str, user: str) -> ExplainersOut:
        parsed, usage = await llm.parse(system=system, user=user, schema=ExplainersOut, effort="medium", max_tokens=6000)
        ledger.add("explainers", usage)
        await ledger.save()
        return parsed

    async def one(ch: dict) -> None:
        try:
            new, used = await explain(call, course=course, title=ch["title"], markdown=ch["markdown"], layouts=layouts)
        except store.Cancelled:
            raise
        except Exception as e:  # noqa: BLE001 - one lesson failing leaves its text as it was
            log.warning("explainer for %s failed: %s", ch["title"], e)
            new, used = None, []
        if new:
            await asyncio.to_thread(_save, ch["id"], new)
            layouts.update(used)
            tally["added"] += 1
        else:
            tally["skipped"] += 1
        tally["done"] += 1
        what = f"Drew {' and '.join(used)} for {ch['title']}" if new else f"Left {ch['title']} as it was"
        await asyncio.to_thread(store.emit, job_id, "explainers", what, {**tally, "layouts": dict(layouts)})

    await gather_limited([lambda ch=ch: one(ch) for ch in todo], CONCURRENCY,
                         lambda: asyncio.to_thread(store.check_cancel, job_id))
    store.emit(job_id, "index", "Indexing the course for the tutor", {})
    chunks = await ingest.ingest_course(course_id, llm_context=False)
    store.emit(job_id, "done", f"Added explainers to {tally['added']} chapters", {"courseId": course_id, **tally,
                                                                                    "layouts": dict(layouts)})
    return {"courseId": course_id, **tally, "layouts": dict(layouts), "chunks": chunks, "usage": ledger.usage()}
