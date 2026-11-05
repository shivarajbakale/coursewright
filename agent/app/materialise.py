"""Parse a course folder (what the builder writes under /course/, and what the seed ships) and write the
course tables in one transaction.

Folder layout:
    outline.json                 CourseOutline
    chapters/<key>.md            chapter markdown
    chapters/<key>.json          ChapterExtras (questions, inline diagrams, diagramRequest)   optional
    diagrams/<key>.flow | .mmd   the diagrammer's diagram for that chapter (kind flow | mermaid)   optional
    projects/<key>.json          ProjectSpec
"""

from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from app.db import jdump, new_id, now, tx
from app.rag.chunk import slugify

MANTINE_COLOURS = {
    "dark", "gray", "red", "pink", "grape", "violet", "indigo", "blue", "cyan", "teal", "green", "lime",
    "yellow", "orange",
}
KEY = r"^[a-z0-9][a-z0-9_-]*$"


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ConceptSpec(Strict):
    key: str = Field(pattern=KEY)
    name: str = Field(min_length=1)
    summary: str = ""


class EdgeSpec(Strict):
    from_: str = Field(alias="from")
    to: str


class ChapterSpec(Strict):
    key: str = Field(pattern=KEY)
    title: str = Field(min_length=1)
    readingMinutes: int = Field(default=8, ge=1, le=120)
    conceptKeys: list[str] = []
    summary: str = ""  # one line: what the chapter teaches (shown when you review the outline)


class ModuleSpec(Strict):
    key: str = Field(pattern=KEY)
    title: str = Field(min_length=1)
    summary: str = ""
    chapters: list[ChapterSpec] = Field(min_length=1)
    projectKey: str | None = None


class CourseOutline(Strict):
    title: str = Field(min_length=1)
    topic: str = ""
    summary: str = ""
    colour: str = "lime"
    icon: str = ""
    concepts: list[ConceptSpec] = []
    edges: list[EdgeSpec] = []
    modules: list[ModuleSpec] = Field(min_length=1)

    @field_validator("colour")
    @classmethod
    def _colour(cls, v: str) -> str:
        return v if v in MANTINE_COLOURS else "lime"

    @model_validator(mode="after")
    def _refs(self) -> "CourseOutline":
        concept_keys = {c.key for c in self.concepts}
        if len(concept_keys) != len(self.concepts):
            raise ValueError("duplicate concept keys")
        chapter_keys = [ch.key for m in self.modules for ch in m.chapters]
        if len(set(chapter_keys)) != len(chapter_keys):
            raise ValueError("duplicate chapter keys")
        for e in self.edges:
            if e.from_ not in concept_keys or e.to not in concept_keys:
                raise ValueError(f"edge {e.from_}->{e.to} references an unknown concept")
        for m in self.modules:
            for ch in m.chapters:
                missing = set(ch.conceptKeys) - concept_keys
                if missing:
                    raise ValueError(f"chapter {ch.key} references unknown concepts {sorted(missing)}")
        return self


class QuestionSpec(Strict):
    prompt: str = Field(min_length=1)
    options: list[str] = Field(min_length=2, max_length=6)
    answer: int = Field(ge=0)
    explanation: str = ""
    conceptKeys: list[str] = []

    @model_validator(mode="after")
    def _answer(self) -> "QuestionSpec":
        if self.answer >= len(self.options):
            raise ValueError("answer index out of range")
        return self


class DiagramSpec(Strict):
    kind: Literal["flow", "mermaid", "svg"]
    title: str = ""
    source: str = Field(min_length=1)


class DiagramRequest(Strict):
    """What the writer wants drawn; the diagrammer turns it into diagrams/<key>.flow or .mmd."""

    title: str = ""
    show: str = Field(min_length=1)
    shape: Literal["process", "structure"] = "process"


class ChapterExtras(Strict):
    questions: list[QuestionSpec] = []
    diagrams: list[DiagramSpec] = []
    diagramRequest: DiagramRequest | None = None


class StarterFile(Strict):
    path: str
    note: str = ""


class RubricItem(Strict):
    criterion: str
    chapterKey: str | None = None


class MilestoneSpec(Strict):
    title: str = Field(min_length=1)
    body: str = ""
    checkCmd: str = ""


class ProjectSpec(Strict):
    title: str = Field(min_length=1)
    brief: str = ""
    starter: list[StarterFile] = []
    hints: list[str] = []
    rubric: list[RubricItem] = []
    milestones: list[MilestoneSpec] = Field(min_length=1)


class MaterialiseError(ValueError):
    pass


class ParsedCourse(BaseModel):
    outline: CourseOutline
    chapters: dict[str, str]
    extras: dict[str, ChapterExtras]
    projects: dict[str, ProjectSpec]


def _load_json(path: Path, model: type[BaseModel]):
    try:
        return model.model_validate(json.loads(path.read_text()))
    except (ValidationError, json.JSONDecodeError) as e:
        raise MaterialiseError(f"{path.name}: {e}") from e


def parse_course_folder(folder: Path) -> ParsedCourse:
    folder = Path(folder)
    outline_path = folder / "outline.json"
    if not outline_path.exists():
        raise MaterialiseError("outline.json is missing")
    outline: CourseOutline = _load_json(outline_path, CourseOutline)
    chapters, extras, projects = {}, {}, {}
    chapter_keys = {ch.key for m in outline.modules for ch in m.chapters}
    for m in outline.modules:
        for ch in m.chapters:
            md = folder / "chapters" / f"{ch.key}.md"
            if not md.exists():
                raise MaterialiseError(f"chapters/{ch.key}.md is missing")
            text = md.read_text().strip()
            if len(text) < 50:
                raise MaterialiseError(f"chapters/{ch.key}.md is empty")
            chapters[ch.key] = text
            side = folder / "chapters" / f"{ch.key}.json"
            extras[ch.key] = _load_json(side, ChapterExtras) if side.exists() else ChapterExtras()
            drawn = _diagram_file(folder, ch.key, extras[ch.key], ch.title)
            if drawn:
                extras[ch.key].diagrams.append(drawn)
        if m.projectKey:
            pj = folder / "projects" / f"{m.projectKey}.json"
            if not pj.exists():
                raise MaterialiseError(f"projects/{m.projectKey}.json is missing")
            spec: ProjectSpec = _load_json(pj, ProjectSpec)
            for item in spec.rubric:
                if item.chapterKey and item.chapterKey not in chapter_keys:
                    item.chapterKey = None
            projects[m.projectKey] = spec
    return ParsedCourse(outline=outline, chapters=chapters, extras=extras, projects=projects)


def _diagram_file(folder: Path, key: str, ex: ChapterExtras, chapter_title: str) -> DiagramSpec | None:
    """diagrams/<key>.flow (preferred) or diagrams/<key>.mmd -> a DiagramSpec. The title comes from the
    chapter's diagramRequest, else the movie's `title` line / Mermaid `%% title:` comment, else the chapter."""
    from app.flowmovie import flow_title, mermaid_title

    req_title = ex.diagramRequest.title if ex.diagramRequest else ""
    for ext, kind, titler in ((".flow", "flow", flow_title), (".mmd", "mermaid", mermaid_title)):
        f = folder / "diagrams" / f"{key}{ext}"
        if f.exists():
            source = f.read_text().strip()
            if not source:
                continue
            return DiagramSpec(kind=kind, title=req_title or titler(source) or chapter_title, source=source + "\n")
    return None


def _reading_minutes(md: str, declared: int) -> int:
    words = len(re.findall(r"\w+", md))
    return max(1, round(words / 220)) if declared <= 0 else declared


def write_course(
    conn: sqlite3.Connection,
    parsed: ParsedCourse,
    *,
    course_id: str | None = None,
    brief: dict | None = None,
    seed_key: str | None = None,
    job_id: str | None = None,
) -> str:
    """Insert (or fill an existing planning row) in one transaction. Returns the course id."""
    o = parsed.outline
    with tx(conn):
        if course_id:
            conn.execute(
                """UPDATE courses SET title=?, slug=?, topic=COALESCE(NULLIF(topic,''), ?), summary=?, colour=?, icon=?,
                          status='ready' WHERE id=?""",
                (o.title, slugify(o.title), o.topic or o.title, o.summary, o.colour, o.icon, course_id),
            )
            # A rebuild replaces content.
            conn.execute("DELETE FROM modules WHERE course_id=?", (course_id,))
            conn.execute("DELETE FROM concepts WHERE course_id=?", (course_id,))
        else:
            course_id = new_id()
            conn.execute(
                """INSERT INTO courses(id, title, slug, topic, summary, brief, status, colour, icon, job_id, seed_key, created_at)
                   VALUES (?,?,?,?,?,?, 'ready', ?,?,?,?,?)""",
                (
                    course_id, o.title, slugify(o.title), o.topic or o.title, o.summary,
                    jdump(brief or {"topic": o.topic or o.title, "answers": []}), o.colour, o.icon, job_id, seed_key,
                    now(),
                ),
            )
        concept_ids = {c.key: new_id() for c in o.concepts}
        for c in o.concepts:
            conn.execute(
                "INSERT INTO concepts(id, course_id, name, summary) VALUES (?,?,?,?)",
                (concept_ids[c.key], course_id, c.name, c.summary),
            )
        for e in o.edges:
            conn.execute(
                "INSERT OR IGNORE INTO concept_edges(from_id, to_id, kind) VALUES (?,?, 'prereq')",
                (concept_ids[e.from_], concept_ids[e.to]),
            )
        chapter_ids = {ch.key: new_id() for m in o.modules for ch in m.chapters}
        for mpos, m in enumerate(o.modules, start=1):
            mid = new_id()
            conn.execute(
                "INSERT INTO modules(id, course_id, position, title, summary) VALUES (?,?,?,?,?)",
                (mid, course_id, mpos, m.title, m.summary),
            )
            for cpos, ch in enumerate(m.chapters, start=1):
                chid = chapter_ids[ch.key]
                md = parsed.chapters[ch.key]
                conn.execute(
                    """INSERT INTO chapters(id, module_id, course_id, position, title, markdown, reading_minutes)
                       VALUES (?,?,?,?,?,?,?)""",
                    (chid, mid, course_id, cpos, ch.title, md, _reading_minutes(md, ch.readingMinutes)),
                )
                for ck in ch.conceptKeys:
                    conn.execute(
                        "INSERT OR IGNORE INTO chapter_concepts(chapter_id, concept_id) VALUES (?,?)",
                        (chid, concept_ids[ck]),
                    )
                ex = parsed.extras.get(ch.key) or ChapterExtras()
                for qpos, q in enumerate(ex.questions):
                    conn.execute(
                        """INSERT INTO questions(id, chapter_id, position, prompt, options, answer, explanation, concept_ids)
                           VALUES (?,?,?,?,?,?,?,?)""",
                        (
                            new_id(), chid, qpos, q.prompt, jdump(q.options), q.answer, q.explanation,
                            jdump([concept_ids[k] for k in q.conceptKeys if k in concept_ids]),
                        ),
                    )
                for dpos, d in enumerate(ex.diagrams):
                    conn.execute(
                        "INSERT INTO diagrams(id, chapter_id, position, kind, title, source, checked_at) VALUES (?,?,?,?,?,?,?)",
                        (new_id(), chid, dpos, d.kind, d.title, d.source, now()),
                    )
            if m.projectKey:
                p = parsed.projects[m.projectKey]
                pid = new_id()
                conn.execute(
                    """INSERT INTO projects(id, module_id, course_id, title, brief, starter, hints, rubric)
                       VALUES (?,?,?,?,?,?,?,?)""",
                    (
                        pid, mid, course_id, p.title, p.brief, jdump([s.model_dump() for s in p.starter]),
                        jdump(p.hints),
                        jdump(
                            [
                                {"criterion": r.criterion, "chapterId": chapter_ids.get(r.chapterKey) if r.chapterKey else None}
                                for r in p.rubric
                            ]
                        ),
                    ),
                )
                for mspos, ms in enumerate(p.milestones, start=1):
                    conn.execute(
                        "INSERT INTO milestones(id, project_id, position, title, body, check_cmd) VALUES (?,?,?,?,?,?)",
                        (new_id(), pid, mspos, ms.title, ms.body, ms.checkCmd),
                    )
    return course_id


def materialise(conn: sqlite3.Connection, folder: Path, **kwargs) -> str:
    return write_course(conn, parse_course_folder(folder), **kwargs)
