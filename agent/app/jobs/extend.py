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


def existing_plan(outline: CourseOutline) -> list[ModulePlan]:
    """The course as it is, in the curriculum's shape, so the new part is checked against it."""
    names = {c.key: c for c in outline.concepts}
    prereqs: dict[str, list[str]] = {}
    for e in outline.edges:
        prereqs.setdefault(e.to, []).append(e.from_)
    modules = []
    for m in outline.modules:
        lessons = []
        for ch in m.chapters:
            key = ch.conceptKeys[0] if ch.conceptKeys else _slug(ch.key)
            c = names.get(key)
            plain = ch.title.split(":", 1)[1].strip() if ":" in ch.title else ""
            lessons.append(LessonPlan(key=key, name=c.name if c else ch.title, plain=plain, summary=ch.summary or "",
                                      prerequisites=prereqs.get(key, []), terms=(c.terms if c else [])[: MAX_DEFINES - 1]))
        modules.append(ModulePlan(title=m.title, summary=m.summary, project=bool(m.projectKey), lessons=lessons))
    return modules


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
    await run.emit("research", "Researching what the course will add", {})
    brief = {**run.brief, "goal": request}
    research = await run.call(
        "research", system=config.prompt("researcher") + "\n\n" + rules(),
        user=f"{brief_text(brief, level=False)}\n\nThe course already teaches:\n{outline_text(outline)}\n\n"
             "Research only the new ground the request asks for.",
        schema=ResearchOut, max_tokens=8000,
    )
    notes_path = run.workdir / "research" / "notes.md"
    notes = (notes_path.read_text() if notes_path.exists() else "") + f"\n\n# Extension: {request}\n\n{research.notes.strip()}\n"
    notes_path.write_text(notes)

    await run.emit("concepts", "Mapping the new concepts on top of the course", {})
    taught = "\n".join(f"- {c.key}: {c.name}" for c in outline.concepts)
    user = (f"{EXTEND_RULES}\n\nThe request: {request}\n\nThe course now:\n{outline_text(outline)}\n\n"
            f"Concept keys it already teaches:\n{taught}\n\nResearch notes for the new part:\n{research.notes}")
    ext, left = await run.checked(
        "curriculum", system=config.prompt("curriculum") + "\n\n" + rules(), user=user, schema=ExtensionOut,
        max_tokens=24000, retries=2, problems=lambda e: extension_problems(outline, e),
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
