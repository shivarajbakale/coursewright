"""Courses written outside the builder: a coding agent (Claude Code, Codex, ...) or a person writes a course
folder (the shape app/materialise.py reads), checks it here, and imports it.

`check_folder` reports every problem it can find in one pass, each with the file it is in, so an agent can
fix them all and run it again. Errors stop an import: the folder can't be read, a reference is broken, a
diagram doesn't compile, or a lesson comes before a concept it rests on. Warnings are the teaching rules the
builder enforces (app/jobs/pedagogy.py) and lesson length; `--strict` treats them as errors too.

`import_folder` writes a checked folder into the database. An imported course is keyed by its title, so
importing the same course again needs `replace=True`, which rewrites its content (and, because the lessons
are new rows, drops the learner's progress and quiz attempts on it).
"""

from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import asdict, dataclass, field
from pathlib import Path

from pydantic import BaseModel, ValidationError

from app.materialise import (
    ChapterExtras,
    CourseOutline,
    MaterialiseError,
    ParsedCourse,
    ProjectSpec,
    parse_course_folder,
    write_course,
)
from app.rag.chunk import slugify

SEED_PREFIX = "authored:"
# The files a course folder may hold; anything else is ignored by the import and rejected by the API.
ALLOWED = re.compile(
    r"^(outline\.json|brief\.json|chapters/[a-z0-9][a-z0-9_-]*\.(md|json)|diagrams/[a-z0-9][a-z0-9_-]*\.(flow|mmd)"
    r"|projects/[a-z0-9][a-z0-9_-]*\.json)$"
)


@dataclass
class Issue:
    level: str  # "error" | "warning"
    path: str  # relative to the course folder
    message: str

    def __str__(self) -> str:
        return f"{self.path}: {self.level}: {self.message}"


@dataclass
class Report:
    issues: list[Issue] = field(default_factory=list)
    title: str = ""
    lessons: int = 0
    modules: int = 0
    flow_checked: bool = True

    def error(self, path: str, message: str) -> None:
        self.issues.append(Issue("error", path, message))

    def warn(self, path: str, message: str) -> None:
        self.issues.append(Issue("warning", path, message))

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.level == "error"]

    @property
    def warnings(self) -> list[Issue]:
        return [i for i in self.issues if i.level == "warning"]

    def ok(self, strict: bool = False) -> bool:
        return not self.errors and not (strict and self.warnings)

    def as_dict(self) -> dict:
        return {
            "title": self.title, "modules": self.modules, "lessons": self.lessons, "flowChecked": self.flow_checked,
            "errors": len(self.errors), "warnings": len(self.warnings), "issues": [asdict(i) for i in self.issues],
        }


def _validation_issues(report: Report, path: str, e: ValidationError) -> None:
    for err in e.errors():
        loc = ".".join(str(p) for p in err["loc"])
        report.error(path, f"{loc}: {err['msg']}" if loc else err["msg"])


def _load(report: Report, folder: Path, rel: str, model: type[BaseModel]):
    try:
        return model.model_validate(json.loads((folder / rel).read_text()))
    except json.JSONDecodeError as e:
        report.error(rel, f"not valid JSON: {e}")
    except ValidationError as e:
        _validation_issues(report, rel, e)
    return None


def _diagram_issue(kind: str, source: str, flow: bool) -> str | None:
    from app import flowmovie

    if kind == "mermaid":
        return flowmovie.mermaid_problem(source)
    if kind == "flow" and flow:
        result = flowmovie.check(source)
        return None if result["ok"] else flowmovie.format_check(result)
    return None


def check_folder(folder: Path, *, flow: bool = True) -> Report:
    """Everything wrong with a course folder. `flow=False` skips compiling Flowmovie diagrams (they need node)."""
    from app import flowmovie
    from app.jobs import pedagogy
    from app.jobs.pipeline import CHAPTER_WORDS, MAX_CHAPTERS, MIN_CHAPTERS, word_count

    folder = Path(folder)
    report = Report()
    if flow and not flowmovie.node_bin():
        flow, report.flow_checked = False, False
        report.warn("diagrams", "node is not installed, so Flowmovie diagrams were not compiled")
    elif not flow:
        report.flow_checked = False
    if not (folder / "outline.json").exists():
        report.error("outline.json", "missing: a course folder starts with outline.json")
        return report
    outline: CourseOutline | None = _load(report, folder, "outline.json", CourseOutline)
    if outline is None:
        return report

    report.title = outline.title
    report.modules = len(outline.modules)
    lessons = [(m, ch) for m in outline.modules for ch in m.chapters]
    report.lessons = len(lessons)
    concepts = {c.key: c for c in outline.concepts}
    chapter_keys = {ch.key for _, ch in lessons}

    # ---- outline shape and teaching order ----
    if len(lessons) < MIN_CHAPTERS:
        report.warn("outline.json", f"{len(lessons)} lessons; a course is usually at least {MIN_CHAPTERS}.")
    if len(lessons) > MAX_CHAPTERS:
        report.warn("outline.json", f"{len(lessons)} lessons; the builder stops at {MAX_CHAPTERS}.")
    for c in outline.concepts:
        for p in pedagogy.concept_name_problems(c.name):
            report.warn("outline.json", f"concept {c.key}: {p}")
    for m in outline.modules:
        for p in pedagogy.module_title_problems(m.title):
            report.warn("outline.json", f"module {m.key}: {p}")
    taught_at: dict[str, int] = {}
    for i, (_, ch) in enumerate(lessons):
        for k in ch.conceptKeys:
            taught_at.setdefault(k, i)
    for c in outline.concepts:
        if c.key not in taught_at:
            report.warn("outline.json", f"concept {c.key} ({c.name}) is not taught by any lesson.")
    for e in outline.edges:
        a, b = taught_at.get(e.from_), taught_at.get(e.to)
        if a is not None and b is not None and a > b:
            report.error(
                "outline.json",
                f"lesson {lessons[b][1].key} teaches {e.to} before lesson {lessons[a][1].key} teaches its "
                f"prerequisite {e.from_}; move the prerequisite earlier.",
            )

    # ---- each lesson ----
    titles = [ch.title for _, ch in lessons]
    for i, (_, ch) in enumerate(lessons):
        md_rel, side_rel = f"chapters/{ch.key}.md", f"chapters/{ch.key}.json"
        if len(ch.conceptKeys) > 1:
            report.warn("outline.json", f"lesson {ch.key} teaches {len(ch.conceptKeys)} concepts; teach one per lesson.")
        elif not ch.conceptKeys and concepts:
            report.warn("outline.json", f"lesson {ch.key} has no conceptKeys.")
        single = concepts[ch.conceptKeys[0]].name if len(ch.conceptKeys) == 1 else None
        for p in pedagogy.title_problems(ch.title, single):
            report.warn("outline.json", f"lesson {ch.key}: {p}")

        md_path = folder / md_rel
        if not md_path.exists():
            report.error(md_rel, "missing: every lesson in outline.json needs its markdown file")
            continue
        md = md_path.read_text().strip()
        if len(md) < 50:
            report.error(md_rel, "empty or nearly empty")
            continue
        first = md.splitlines()[0].strip()
        if first != f"# {ch.title}":
            report.warn(md_rel, f'should start with "# {ch.title}" (the title in outline.json), found "{first[:80]}"')
        words = word_count(md)
        lo, hi = CHAPTER_WORDS
        if not lo <= words <= hi:
            report.warn(md_rel, f"{words} words of prose; a lesson is {lo}-{hi} (aim for 350-650).")
        for s in pedagogy.assumes_experience(md):
            report.warn(md_rel, f'assumes the learner already knows the topic: "{s}"')
        later = [concepts[k].name for k, j in taught_at.items() if j > i and k in concepts]
        for t in pedagogy.future_terms(md, later):
            report.warn(md_rel, f'uses "{t}", which a later lesson teaches; describe it in plain words or reorder.')
        body = md[len(first):]
        for t in titles[i + 1:]:
            if re.search(re.escape(t), body, re.I):
                report.warn(md_rel, f'refers to the later lesson "{t}".')

        extras = ChapterExtras()
        if (folder / side_rel).exists():
            extras = _load(report, folder, side_rel, ChapterExtras) or ChapterExtras()
        if not extras.questions:
            report.warn(side_rel, "no check-yourself questions; add 2-3.")
        for qi, q in enumerate(extras.questions):
            unknown = set(q.conceptKeys) - concepts.keys()
            if unknown:
                report.warn(side_rel, f"questions.{qi}: unknown conceptKeys {sorted(unknown)} are dropped on import.")
        for di, d in enumerate(extras.diagrams):
            problem = _diagram_issue(d.kind, d.source, flow)
            if problem:
                report.error(side_rel, f"diagrams.{di} ({d.kind}): {problem}")
        for ext, kind in ((".flow", "flow"), (".mmd", "mermaid")):
            f = folder / "diagrams" / f"{ch.key}{ext}"
            if f.exists():
                problem = _diagram_issue(kind, f.read_text(), flow)
                if problem:
                    report.error(f"diagrams/{ch.key}{ext}", problem)

    # ---- projects ----
    for m in outline.modules:
        if not m.projectKey:
            continue
        rel = f"projects/{m.projectKey}.json"
        if not (folder / rel).exists():
            report.error(rel, f"missing: module {m.key} names project {m.projectKey}")
            continue
        spec: ProjectSpec | None = _load(report, folder, rel, ProjectSpec)
        for ri, r in enumerate(spec.rubric if spec else []):
            if r.chapterKey and r.chapterKey not in chapter_keys:
                report.warn(rel, f"rubric.{ri}: chapterKey {r.chapterKey} is not a lesson; it is dropped on import.")

    # ---- files the outline doesn't know about ----
    for sub, keys in (("chapters", chapter_keys), ("diagrams", chapter_keys)):
        d = folder / sub
        for f in sorted(d.iterdir()) if d.is_dir() else []:
            if f.is_file() and f.suffix in (".md", ".json", ".flow", ".mmd") and f.name.split(".")[0] not in keys:
                report.warn(f"{sub}/{f.name}", "not in outline.json, so it is not imported.")

    # The import reads the folder with the same parser; anything it still refuses is an error.
    if not report.errors:
        try:
            parse_course_folder(folder)
        except MaterialiseError as e:
            report.error("outline.json", str(e))
    return report


# ---- import -------------------------------------------------------------------------------------


class ImportConflict(ValueError):
    def __init__(self, course_id: str, title: str):
        super().__init__(f'A course named "{title}" was already imported; import again with replace to update it.')
        self.course_id = course_id


def add_maps(parsed: ParsedCourse) -> None:
    """Every lesson ends with the "Your map so far" diagram the builder draws; an authored course gets the
    same one, drawn from its concepts and prerequisite edges, unless the folder already has it."""
    from app.jobs.pipeline import MAP_TITLE, map_diagram

    o = parsed.outline
    if not o.concepts:
        return
    for m in o.modules:
        for ch in m.chapters:
            ex = parsed.extras.setdefault(ch.key, ChapterExtras())
            if not any(d.title == MAP_TITLE for d in ex.diagrams):
                ex.diagrams.append(map_diagram(o, ch))


def seed_key(title: str) -> str:
    return SEED_PREFIX + slugify(title)


def import_folder(conn: sqlite3.Connection, folder: Path, *, replace: bool = False) -> tuple[str, bool]:
    """Write a checked course folder as a ready course. Returns (course id, created)."""
    from app.db import row

    folder = Path(folder)
    parsed = parse_course_folder(folder)
    add_maps(parsed)
    key = seed_key(parsed.outline.title)
    brief = None
    if (folder / "brief.json").exists():
        try:
            brief = json.loads((folder / "brief.json").read_text())
        except json.JSONDecodeError as e:
            raise MaterialiseError(f"brief.json: {e}") from e
    existing = row(conn, "SELECT id FROM courses WHERE seed_key=?", (key,))
    if existing and not replace:
        raise ImportConflict(existing["id"], parsed.outline.title)
    if existing:
        course_id = write_course(conn, parsed, course_id=existing["id"])
        _drop_stale_sources(conn, course_id)
        return course_id, False
    return write_course(conn, parsed, seed_key=key, brief=brief), True


def _drop_stale_sources(conn: sqlite3.Connection, course_id: str) -> None:
    """A replace gives every lesson a new id; the tutor's index of the old lessons goes with them."""
    from app.db import rows
    from app.rag.ingest import delete_source

    for s in rows(
        conn,
        """SELECT id FROM sources WHERE kind='chapter' AND course_id=?
           AND chapter_id NOT IN (SELECT id FROM chapters WHERE course_id=?)""",
        (course_id, course_id),
    ):
        delete_source(conn, s["id"])


def write_bundle(files: dict[str, str], dest: Path) -> list[str]:
    """Lay a {relative path: text} bundle out as a course folder. Returns the paths it refused."""
    refused = []
    for rel, text in files.items():
        if not ALLOWED.match(rel):
            refused.append(rel)
            continue
        p = dest / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text)
    return refused


def read_bundle(folder: Path) -> dict[str, str]:
    """The inverse of write_bundle: every allowed file under `folder`."""
    folder = Path(folder)
    out = {}
    for p in sorted(folder.rglob("*")):
        rel = p.relative_to(folder).as_posix()
        if p.is_file() and ALLOWED.match(rel):
            out[rel] = p.read_text()
    return out


def schemas() -> dict:
    """JSON Schemas of the three JSON file kinds, for an agent that wants the exact shape."""
    return {
        "outline.json": CourseOutline.model_json_schema(by_alias=True),
        "chapters/<key>.json": ChapterExtras.model_json_schema(),
        "projects/<key>.json": ProjectSpec.model_json_schema(),
    }


# ---- check + import, local or to a running server (shared by the CLI and the MCP server) ------------


async def import_course(folder: Path, *, replace: bool = False, strict: bool = False, server: str | None = None) -> dict:
    """Check the folder, then import it into the local database or, with `server`, a running Coursewright
    (POST /api/courses/import, CW_SHARED_SECRET sent as x-cw-secret). Returns
    {"ok", "message", "report", and on success "courseId", "created", "path"}."""
    import asyncio
    import os

    folder = Path(folder)
    report = await asyncio.to_thread(check_folder, folder)
    if not report.ok(strict):
        return {"ok": False, "message": "Not imported: fix the errors in the report and try again.",
                "report": report.as_dict()}
    if server:
        import httpx

        headers = {"x-cw-secret": os.environ["CW_SHARED_SECRET"]} if os.environ.get("CW_SHARED_SECRET") else {}
        body = {"files": read_bundle(folder), "replace": replace, "strict": strict}
        async with httpx.AsyncClient(timeout=600) as client:
            r = await client.post(server.rstrip("/") + "/api/courses/import", json=body, headers=headers)
        data = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"message": r.text}
        if r.status_code >= 400:
            return {"ok": False, "message": f"Not imported ({r.status_code}): {data.get('message')}",
                    "report": data.get("report") or report.as_dict()}
        c, created = data["data"]["course"], data["data"]["created"]
        return {"ok": True, "courseId": c["id"], "created": created, "path": f"/courses/{c['id']}",
                "message": f'{"Imported" if created else "Replaced"} "{c["title"]}" ({c["chapterCount"]} lessons) on {server}',
                "report": report.as_dict()}

    from app import config
    from app.db import db, init_db
    from app.rag import ingest

    def save() -> tuple[str, bool]:
        init_db()
        with db() as conn:
            return import_folder(conn, folder, replace=replace)

    try:
        course_id, created = await asyncio.to_thread(save)
    except ImportConflict as e:
        return {"ok": False, "message": str(e), "report": report.as_dict()}
    chunks = await ingest.ingest_course(course_id, llm_context=bool(config.anthropic_key()))
    return {"ok": True, "courseId": course_id, "created": created, "path": f"/courses/{course_id}",
            "message": f'{"Imported" if created else "Replaced"} "{report.title}" ({report.lessons} lessons, '
                       f"{chunks} chunks indexed) into {config.db_path()}",
            "report": report.as_dict()}
