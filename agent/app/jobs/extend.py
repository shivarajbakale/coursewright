"""Extending a finished course: new modules after the last one, planned and written by the same pipeline.

    POST /api/courses/:id/extend {"request": "..."} queues a build_course job with {"extend": request}.
    That job researches the new ground (notes appended to research/notes.md), then one curriculum call plans
    only the new modules. The plan may build on any concept the course already teaches; code checks the whole
    course as one map (order, titles, nothing assumed), sends problems back twice, and merges the new modules
    after the old ones without renumbering anything that exists. The course keeps status 'ready' and stays
    readable; the plan waits for approval like a new outline (GET/POST /courses/:id/plan...). Approving
    writes only the new lessons (every stage skips files on disk), and the new modules are appended to the
    database, so the existing chapters keep their ids, progress, notes and tutor index.
"""

from __future__ import annotations

import json
import logging

from pydantic import BaseModel, Field

from app import config
from app.jobs import pedagogy
from app.jobs.pipeline import (
    MAX_DEFINES,
    CourseOutline,
    CurriculumOut,
    LessonPlan,
    ModulePlan,
    ResearchOut,
    Run,
    _slug,
    _title,
    brief_text,
    curriculum_problems,
    outline_text,
    rules,
)

log = logging.getLogger(__name__)

NEW_LESSONS = (15, 70)

EXTEND_RULES = """You are extending a course that already exists. Do not repeat or rename anything it teaches.
Plan only the NEW modules that come after its last module, as `modules`. Each new lesson may list as
prerequisites the keys of concepts the course already teaches (listed below) or earlier new lessons. The
same rules hold: one concept per lesson, every lesson builds on earlier ones, titles name the concept in
plain words, nothing assumed that the course has not taught. Go deep: the learner should finish able to
build what the request describes, so plan the intermediate steps between the existing course and the
advanced ideas rather than jumping."""


class ExtensionOut(BaseModel):
    summary: str = Field(default="", description="The whole course's summary, rewritten to include the new modules")
    modules: list[ModulePlan]


def existing_plan(outline: CourseOutline, modules: list | None = None) -> list[ModulePlan]:
    """The course as it is (or `modules` of it), in the curriculum's shape, so the new part is checked
    against it."""
    names = {c.key: c for c in outline.concepts}
    prereqs: dict[str, list[str]] = {}
    for e in outline.edges:
        prereqs.setdefault(e.to, []).append(e.from_)
    out = []
    for m in outline.modules if modules is None else modules:
        lessons = []
        for ch in m.chapters:
            key = ch.conceptKeys[0] if ch.conceptKeys else _slug(ch.key)
            c = names.get(key)
            plain = ch.title.split(":", 1)[1].strip() if ":" in ch.title else ""
            lessons.append(LessonPlan(key=key, name=c.name if c else ch.title, plain=plain, summary=ch.summary or "",
                                      prerequisites=prereqs.get(key, []), terms=(c.terms if c else [])[: MAX_DEFINES - 1]))
        out.append(ModulePlan(title=m.title, summary=m.summary, project=bool(m.projectKey), lessons=lessons))
    return out


def extension_problems(outline: CourseOutline, ext: ExtensionOut) -> list[str]:
    """Problems the new modules bring: the whole course is checked, minus what was already there."""
    old = existing_plan(outline)
    known = set(curriculum_problems(CurriculumOut(title=outline.title, modules=old)))
    combined = CurriculumOut(title=outline.title, summary=ext.summary or outline.summary, modules=old + ext.modules)
    found = [p for p in curriculum_problems(combined) if p not in known and not p.startswith("The course has ")]
    taught = {_slug(c.key) for c in outline.concepts} | {pedagogy._norm(c.name) for c in outline.concepts}
    new = [ls for m in ext.modules for ls in m.lessons]
    lo, hi = NEW_LESSONS
    if not lo <= len(new) <= hi:
        found.append(f"The new modules hold {len(new)} lessons; plan {lo}-{hi}.")
    for ls in new:
        if _slug(ls.key) in taught or pedagogy._norm(ls.name) in taught:
            found.append(f'"{ls.name}" is already taught by the course; build on it instead of teaching it again.')
    return found


def merge(outline: CourseOutline, ext: ExtensionOut) -> CourseOutline:
    """The course with the new modules after its last one. Nothing that exists is renamed or renumbered:
    the files on disk and the rows in the database are found by these keys."""
    data = outline.model_dump(by_alias=True)
    concept_keys = {c["key"] for c in data["concepts"]}
    n = sum(len(m["chapters"]) for m in data["modules"])
    mi = len(data["modules"])
    edges = {(e["from"], e["to"]) for e in data["edges"]}
    for m in ext.modules:
        chapters = []
        for ls in m.lessons:
            k = _slug(ls.key)
            if k in concept_keys:
                continue
            concept_keys.add(k)
            n += 1
            terms = [t.strip() for t in ls.terms if t.strip() and pedagogy._norm(t) != pedagogy._norm(ls.name)][:3]
            data["concepts"].append({"key": k, "name": ls.name.strip(), "summary": ls.summary.strip(), "terms": terms})
            for p in ls.prerequisites:
                fr = _slug(p)
                if fr in concept_keys and fr != k and (fr, k) not in edges:
                    edges.add((fr, k))
                    data["edges"].append({"from": fr, "to": k})
            chapters.append({"key": f"c{n:02d}-{_slug(ls.key, 30)}", "title": _title(ls), "readingMinutes": 4,
                             "conceptKeys": [k], "summary": ls.summary.strip()})
        if chapters:
            mi += 1
            data["modules"].append({
                "key": f"m{mi}", "title": m.title.strip().rstrip("."), "summary": m.summary.strip(), "chapters": chapters,
                "projectKey": f"p{mi}-{_slug(m.title, 30)}" if m.project else None,
            })
    if ext.summary.strip():
        data["summary"] = ext.summary.strip()
    return CourseOutline.model_validate(data)


async def plan_extension(run: Run, outline: CourseOutline, request: str) -> CourseOutline:
    """Research the new ground, plan the new modules, check them against the course, merge."""
    notes_path = run.workdir / "research" / "notes.md"
    existing = notes_path.read_text() if notes_path.exists() else ""
    header = f"# Extension: {request}"
    if header in existing:  # a retry after a failed planning call: the research is already done
        new_notes = existing.split(header, 1)[1].strip()
    else:
        await run.emit("research", "Researching what the course will add", {})
        brief = {**run.brief, "goal": request}
        research = await run.call(
            "research", system=config.prompt("researcher") + "\n\n" + rules(),
            user=f"{brief_text(brief, level=False)}\n\nThe course already teaches:\n{outline_text(outline)}\n\n"
                 "Research only the new ground the request asks for.",
            schema=ResearchOut, max_tokens=8000,
        )
        new_notes = research.notes.strip()
        notes_path.write_text(f"{existing}\n\n{header}\n\n{new_notes}\n")

    await run.emit("concepts", "Mapping the new concepts on top of the course", {})
    taught = "\n".join(f"- {c.key}: {c.name}" for c in outline.concepts)
    user = (f"{EXTEND_RULES}\n\nThe request: {request}\n\nThe course now:\n{outline_text(outline)}\n\n"
            f"Concept keys it already teaches:\n{taught}\n\nResearch notes for the new part:\n{new_notes}")
    ext, left = await run.checked(
        "curriculum", system=config.prompt("curriculum") + "\n\n" + rules(), user=user, schema=ExtensionOut,
        max_tokens=20000, retries=2, problems=lambda e: extension_problems(outline, e),
        previous=lambda e: e.model_dump_json(),
    )
    if left:
        log.info("extension problems left after the retries: %s", left)
    merged = merge(outline, ext)
    added = sum(len(m.chapters) for m in merged.modules) - sum(len(m.chapters) for m in outline.modules)
    if added < NEW_LESSONS[0]:
        raise RuntimeError(f"the extension came back with {added} lessons; try again")
    run.save_outline(merged)
    (run.workdir / "extend.json").write_text(json.dumps({"request": request, "from": len(outline.modules)}, indent=2))
    await run.emit("outline", f"Planned {len(merged.modules) - len(outline.modules)} new modules, {added} lessons",
                   {"modules": [m.title for m in merged.modules[len(outline.modules):]], "review": True})
    return merged


# ---- reshaping a pending extension ----------------------------------------------------------------------


class ExtensionChatOut(BaseModel):
    extension: ExtensionOut
    reply: str = Field(description="One plain line saying what changed")


def base_outline(outline: CourseOutline, modules: int) -> CourseOutline:
    """The course before the extension: its first `modules` modules, their concepts and edges."""
    data = outline.model_dump(by_alias=True)
    data["modules"] = data["modules"][:modules]
    keys = {k for m in data["modules"] for ch in m["chapters"] for k in ch["conceptKeys"]}
    data["concepts"] = [c for c in data["concepts"] if c["key"] in keys]
    data["edges"] = [e for e in data["edges"] if e["from"] in keys and e["to"] in keys]
    return CourseOutline.model_validate(data)


def pending_base(workdir) -> int | None:
    """How many modules the course had before a pending extension, or None when there is none."""
    f = workdir / "extend.json"
    try:
        return int(json.loads(f.read_text())["from"]) if f.exists() else None
    except (ValueError, KeyError, json.JSONDecodeError):
        return None


async def reshape(outline: CourseOutline, modules: int, message: str, history: str) -> tuple[CourseOutline, str, int]:
    """The outline chat for an extension: the model sees the whole course but answers with the new modules
    only, so a long course still fits in one reply and the existing lessons cannot change."""
    from app.agents import llm

    base = base_outline(outline, modules)
    current = ExtensionOut(summary=outline.summary, modules=existing_plan(outline, outline.modules[modules:]))
    system = config.prompt("outline_chat") + "\n\n" + config.prompt("curriculum") + "\n\n" + rules()
    taught = "\n".join(f"- {c.key}: {c.name}" for c in base.concepts)
    user = (f"{EXTEND_RULES}\n\nThe course before the extension (unchangeable):\n{outline_text(base)}\n\n"
            f"Concept keys it teaches:\n{taught}\n\nThe planned extension (JSON), which you change:\n"
            f"{current.model_dump_json()}\n\n" + (f"Earlier in this conversation:\n{history}\n\n" if history else "")
            + f"The learner asks: {message}\n\nAnswer with the whole extension after the change, and one line saying what changed.")
    tokens = 0
    out, usage = await llm.parse(system=system, user=user, schema=ExtensionChatOut, max_tokens=20000)
    tokens += usage.get("inputTokens", 0) + usage.get("outputTokens", 0)
    known = set(extension_problems(base, current))
    problems = [p for p in extension_problems(base, out.extension) if p not in known]
    if problems:
        retry = user + "\n\nYour previous answer had these problems. Fix every one:\n" + "\n".join(f"- {p}" for p in problems)
        out, usage = await llm.parse(system=system, user=retry, schema=ExtensionChatOut, max_tokens=20000)
        tokens += usage.get("inputTokens", 0) + usage.get("outputTokens", 0)
    return merge(base, out.extension), out.reply.strip(), tokens
