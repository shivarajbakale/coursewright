"""The course build pipeline: plain code runs the stages in order, one structured model call per artifact.

Plan phase (one job):
    research   one call: notes, terms, references          -> research/notes.md, research/refs.json
    curriculum one call: concepts, edges, modules, chapters -> course/outline.json, course/graph.json
               checked in code (size, every concept taught, prerequisites in order, chapter 1 has none);
               one retry carrying the problems, then code repairs what is left
    pause      with the brief's `reviewOutline`, the job ends here and the learner reshapes the outline
               (api/plans.py); approving it queues a writing job on the same folder

Write phase:
    chapters   one call per chapter, four at a time, each given only what it needs: the brief, the notes,
               the outline's titles and summaries, the concepts earlier chapters taught, and its own spec;
               checked in code (title, length, one key-idea callout, banned words, 2-4 questions), one retry
    diagrams   for at most half the chapters, a checked Flowmovie for a process, Mermaid for a structure
    projects   one call per module
    review     one call over the whole course, then a targeted rewrite of at most MAX_FIXES chapters

Every stage skips work whose files are already on disk and valid, so a stopped build continues where it
was. Tokens are counted per stage (`Ledger`) and kept on the job. Compared with the agent orchestrator this
replaced (every subagent call re-read the outline, the research and its own history), a course costs about
a twentieth of the tokens.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import re
from pathlib import Path
from typing import Awaitable, Callable, TypeVar

from pydantic import BaseModel, Field

from app import config
from app.agents import llm
from app.jobs import store
from app.materialise import (
    ChapterExtras,
    ChapterSpec,
    CourseOutline,
    DiagramRequest,
    MaterialiseError,
    ProjectSpec,
    QuestionSpec,
    _load_json,
)

log = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

MAX_CHAPTERS = 14
CHAPTER_WORDS = (450, 1300)  # the prompt asks for 700-1200; outside this a chapter is sent back once
MAX_FIXES = 4
CHAPTER_CONCURRENCY = 4
BANNED = re.compile(r"\b(simply|obviously|trivially)\b|\bit is easy to see\b", re.I)
KEY_IDEA = "> **Key idea:**"


# ---- model output shapes ----------------------------------------------------------------------------


class Reference(BaseModel):
    title: str
    url: str = ""


class ResearchOut(BaseModel):
    notes: str
    terms: list[str] = []
    references: list[Reference] = []


class ChapterOut(BaseModel):
    markdown: str
    questions: list[QuestionSpec] = []
    diagramRequest: DiagramRequest | None = None


class Blocking(BaseModel):
    chapterKey: str
    problem: str


class ReviewOut(BaseModel):
    blocking: list[Blocking] = []


class OutlineChatOut(BaseModel):
    outline: CourseOutline
    reply: str = Field(description="One plain line saying what changed")


# ---- tokens -----------------------------------------------------------------------------------------


class Ledger:
    """Tokens per stage, kept on the job row as they are spent."""

    def __init__(self, job_id: str | None, start: dict | None = None) -> None:
        self.job_id = job_id
        self.stages: dict[str, dict] = {k: dict(v) for k, v in ((start or {}).get("stages") or {}).items()}

    def add(self, stage: str, usage: dict) -> None:
        s = self.stages.setdefault(stage, {"inputTokens": 0, "outputTokens": 0, "calls": 0})
        s["inputTokens"] += int(usage.get("inputTokens") or 0)
        s["outputTokens"] += int(usage.get("outputTokens") or 0)
        s["calls"] += 1

    @property
    def input_tokens(self) -> int:
        return sum(s["inputTokens"] for s in self.stages.values())

    @property
    def output_tokens(self) -> int:
        return sum(s["outputTokens"] for s in self.stages.values())

    @property
    def total(self) -> int:
        return self.input_tokens + self.output_tokens

    def usage(self) -> dict:
        return {"inputTokens": self.input_tokens, "outputTokens": self.output_tokens, "stages": self.stages}

    async def save(self) -> None:
        if self.job_id:
            await asyncio.to_thread(store.set_usage, self.job_id, self.input_tokens, self.output_tokens, self.stages)


def estimate_tokens(outline: CourseOutline) -> int:
    """A rough cost to write this outline: chapters, half of them drawn, projects, one review."""
    chapters = sum(len(m.chapters) for m in outline.modules)
    projects = sum(1 for m in outline.modules if m.projectKey)
    return chapters * 11_000 + math.ceil(chapters / 2) * 14_000 + projects * 7_000 + 30_000


# ---- checks in code ---------------------------------------------------------------------------------


def _taught_at(outline: CourseOutline) -> dict[str, int]:
    """concept key -> index of the first chapter that teaches it."""
    out: dict[str, int] = {}
    for i, ch in enumerate(ch for m in outline.modules for ch in m.chapters):
        for k in ch.conceptKeys:
            out.setdefault(k, i)
    return out


def outline_problems(outline: CourseOutline) -> list[str]:
    problems = []
    chapters = [ch for m in outline.modules for ch in m.chapters]
    if len(chapters) > MAX_CHAPTERS:
        over = len(chapters) - MAX_CHAPTERS
        problems.append(
            f"The outline has {len(chapters)} chapters; the most is {MAX_CHAPTERS}. Merge or drop {over} "
            f"chapter{'s' if over > 1 else ''}, and count them again before you answer."
        )
    taught = _taught_at(outline)
    names = {c.key: c.name for c in outline.concepts}
    for c in outline.concepts:
        if c.key not in taught:
            problems.append(f"Concept {c.key} ({c.name}) is in the graph but no chapter teaches it.")
    for e in outline.edges:
        if e.from_ in taught and e.to in taught and taught[e.from_] > taught[e.to]:
            ch = chapters[taught[e.to]]
            problems.append(
                f"Chapter {ch.key} teaches {names.get(e.to, e.to)} before its prerequisite "
                f"{names.get(e.from_, e.from_)}, which is taught later."
            )
    if chapters:
        first = set(chapters[0].conceptKeys)
        for e in outline.edges:
            if e.to in first and e.from_ not in first:
                problems.append(
                    f"The first chapter needs {names.get(e.from_, e.from_)} first: chapter 1 must start from "
                    "concepts with no prerequisites."
                )
    project_keys = [m.projectKey for m in outline.modules if m.projectKey]
    if len(set(project_keys)) != len(project_keys):
        problems.append("Two modules share a projectKey.")
    return problems


def repair_outline(outline: CourseOutline) -> CourseOutline:
    """What code can fix itself: drop concepts no chapter teaches (and their edges), and edges that point
    backwards in teaching order (a prerequisite taught later is not a prerequisite the course honours)."""
    taught = _taught_at(outline)
    data = outline.model_dump(by_alias=True)
    data["concepts"] = [c for c in data["concepts"] if c["key"] in taught]
    data["edges"] = [
        e for e in data["edges"] if e["from"] in taught and e["to"] in taught and taught[e["from"]] <= taught[e["to"]]
    ]
    return CourseOutline.model_validate(data)


def word_count(markdown: str) -> int:
    prose = re.sub(r"```.*?```", " ", markdown, flags=re.S)
    return len(re.findall(r"[A-Za-z0-9][\w'-]*", prose))


def tidy(out: ChapterOut, title: str) -> ChapterOut:
    """What code fixes without asking: a missing `# title`, and a second key-idea callout (the first stays,
    later ones become plain quotes)."""
    md = out.markdown.strip()
    if not md.startswith("# "):
        md = f"# {title}\n\n{md}"
    first = md.find(KEY_IDEA)
    if first >= 0:
        head, tail = md[: first + len(KEY_IDEA)], md[first + len(KEY_IDEA):]
        md = head + tail.replace(KEY_IDEA, ">")
    return out.model_copy(update={"markdown": md})


def chapter_problems(out: ChapterOut, title: str) -> list[str]:
    md = out.markdown.strip()
    problems = []
    if not md.startswith("# "):
        problems.append(f"The markdown must start with `# {title}`.")
    words = word_count(md)
    lo, hi = CHAPTER_WORDS
    if words > hi:
        problems.append(f"The chapter is {words} words; the limit is 1200. Cut it, don't summarise it.")
    elif words < lo:
        problems.append(f"The chapter is only {words} words; it needs 700-1200 words of real teaching.")
    callouts = md.count(KEY_IDEA)
    if callouts != 1:
        problems.append(f"The chapter needs exactly one `{KEY_IDEA}` line; it has {callouts}.")
    banned = sorted({m.group(0).lower() for m in BANNED.finditer(md)})
    if banned:
        problems.append(f"Remove these words, and explain the step they skip instead: {', '.join(banned)}.")
    if not 2 <= len(out.questions) <= 4:
        problems.append(f"Give 2-4 questions; there are {len(out.questions)}.")
    return problems


# ---- context the stages share -----------------------------------------------------------------------


def brief_text(brief: dict) -> str:
    lines = [f"Topic: {brief.get('topic')}"]
    for k in ("level", "goal", "pace"):
        if brief.get(k):
            lines.append(f"{k.capitalize()}: {brief[k]}")
    for a in brief.get("answers") or []:
        lines.append(f"- {a.get('question')}: {', '.join(a.get('answer') or []) or '(skipped)'}")
    return "\n".join(lines)


def outline_text(outline: CourseOutline) -> str:
    """The outline as numbered lines, the cheapest form every stage can read."""
    names = {c.key: c.name for c in outline.concepts}
    count = sum(len(m.chapters) for m in outline.modules)
    lines = [f"Course: {outline.title} ({len(outline.modules)} modules, {count} chapters)"]
    for mi, m in enumerate(outline.modules, start=1):
        lines.append(f"{mi}. {m.title}" + (f" (project {m.projectKey})" if m.projectKey else ""))
        for ci, ch in enumerate(m.chapters, start=1):
            concepts = ", ".join(names.get(k, k) for k in ch.conceptKeys)
            lines.append(f"  {mi}.{ci} [{ch.key}] {ch.title}: {ch.summary}" + (f" (teaches {concepts})" if concepts else ""))
    return "\n".join(lines)


def rules() -> str:
    return config.prompt("course_format")


def _ensure_dirs(workdir: Path) -> None:
    for d in ("research", "course/chapters", "course/projects", "course/diagrams"):
        (workdir / d).mkdir(parents=True, exist_ok=True)


class Run:
    """One job's pass through the pipeline."""

    def __init__(self, job_id: str | None, workdir: Path, brief: dict, ledger: Ledger,
                 emit: Callable[[str, str, dict], None] | None = None) -> None:
        self.job_id = job_id
        self.workdir = Path(workdir)
        self.course = self.workdir / "course"
        self.brief = brief
        self.ledger = ledger
        self._emit = emit or (lambda stage, msg, payload: store.emit(job_id, stage, msg, payload) if job_id else None)
        _ensure_dirs(self.workdir)

    async def emit(self, stage: str, message: str, payload: dict | None = None) -> None:
        await asyncio.to_thread(self._emit, stage, message, payload or {})

    async def check_cancel(self) -> None:
        if self.job_id:
            await asyncio.to_thread(store.check_cancel, self.job_id)

    async def call(self, stage: str, *, system: str, user: str, schema: type[T], max_tokens: int,
                   effort: llm.Effort = "medium") -> T:
        parsed, usage = await llm.parse(system=system, user=user, schema=schema, effort=effort, max_tokens=max_tokens)
        self.ledger.add(stage, usage)
        await self.ledger.save()
        return parsed

    async def checked(self, stage: str, *, system: str, user: str, schema: type[T], max_tokens: int,
                      problems: Callable[[T], list[str]], retries: int = 1,
                      previous: Callable[[T], str] | None = None) -> tuple[T, list[str]]:
        """One call, checked in code; up to `retries` more that name the problems. With `previous`, a retry
        shows the model its last draft to revise (a fresh rewrite tends to repeat the problem). Returns what's
        left."""
        out = await self.call(stage, system=system, user=user, schema=schema, max_tokens=max_tokens)
        found = problems(out)
        for _ in range(retries):
            if not found:
                break
            shown = f"\n\nYour previous draft:\n{previous(out)}\n\nRevise that draft" if previous else (
                "\n\nYour previous answer"
            )
            retry = user + shown + " to fix these problems, keeping everything else:\n" + "\n".join(f"- {p}" for p in found)
            out = await self.call(stage, system=system, user=retry, schema=schema, max_tokens=max_tokens)
            found = problems(out)
        return out, found

    # -- plan ------------------------------------------------------------------------------------------

    def research_notes(self) -> str:
        p = self.workdir / "research" / "notes.md"
        return p.read_text() if p.exists() else ""

    async def research(self) -> str:
        notes = self.research_notes()
        if notes:
            return notes
        terms = [w for w in re.findall(r"[A-Za-z][\w-]+", self.brief.get("topic", "")) if len(w) > 2][:6]
        await self.emit("research", "Researching the topic", {"terms": terms})
        out = await self.call(
            "research", system=config.prompt("researcher") + "\n\n" + rules(), user=brief_text(self.brief),
            schema=ResearchOut, max_tokens=6000,
        )
        (self.workdir / "research" / "refs.json").write_text(
            json.dumps({"terms": out.terms, "refs": [r.model_dump() for r in out.references]}, indent=2)
        )
        (self.workdir / "research" / "notes.md").write_text(out.notes.strip() + "\n")
        await self.emit("research", "Research notes ready", {"terms": [t[:40] for t in out.terms][:10]})
        return out.notes

    def outline(self) -> CourseOutline | None:
        p = self.course / "outline.json"
        if not p.exists():
            return None
        try:
            return _load_json(p, CourseOutline)
        except MaterialiseError:
            return None

    def save_outline(self, outline: CourseOutline) -> None:
        save_outline(self.workdir, outline)

    async def curriculum(self, notes: str) -> CourseOutline:
        existing = self.outline()
        if existing:
            return existing
        await self.emit("concepts", "Mapping the concepts and outlining the course", {})
        outline, left = await self.checked(
            "curriculum",
            system=config.prompt("curriculum") + "\n\n" + rules(),
            user=f"{brief_text(self.brief)}\n\nResearch notes:\n{notes}",
            schema=CourseOutline, max_tokens=8000, problems=outline_problems, retries=2,
        )
        if left:
            log.info("outline problems left after a retry, repaired in code: %s", left)
            outline = repair_outline(outline)
        self.save_outline(outline)
        await self.emit("concepts", f"Mapped {len(outline.concepts)} concepts", {"concepts": [c.name for c in outline.concepts]})
        chapters = sum(len(m.chapters) for m in outline.modules)
        await self.emit(
            "outline", f"Outlined {len(outline.modules)} modules, {chapters} chapters",
            {"modules": [m.title for m in outline.modules]},
        )
        return outline

    async def plan(self) -> CourseOutline:
        notes = await self.research()
        await self.check_cancel()
        return await self.curriculum(notes)

    # -- write -----------------------------------------------------------------------------------------

    def chapter_done(self, key: str) -> bool:
        md, side = self.course / "chapters" / f"{key}.md", self.course / "chapters" / f"{key}.json"
        if not (md.exists() and side.exists() and len(md.read_text().strip()) >= 50):
            return False
        try:
            _load_json(side, ChapterExtras)
            return True
        except MaterialiseError:
            return False

    def write_chapter_files(self, key: str, out: ChapterOut) -> None:
        (self.course / "chapters" / f"{key}.md").write_text(out.markdown.strip() + "\n")
        extras = ChapterExtras(questions=out.questions, diagramRequest=out.diagramRequest)
        (self.course / "chapters" / f"{key}.json").write_text(extras.model_dump_json(indent=2, exclude_none=True))

    def chapter_prompt(self, outline: CourseOutline, ch: ChapterSpec, notes: str) -> str:
        chapters = [c for m in outline.modules for c in m.chapters]
        before = chapters[: chapters.index(ch)]
        concepts = {c.key: c for c in outline.concepts}
        earlier = [concepts[k] for c in before for k in c.conceptKeys if k in concepts]
        taught = "\n".join(f"- {c.name}: {c.summary}" for c in earlier) or "(none: this is the first chapter)"
        own = "\n".join(f"- {concepts[k].name} [{k}]: {concepts[k].summary}" for k in ch.conceptKeys if k in concepts)
        return (
            f"{brief_text(self.brief)}\n\nResearch notes:\n{notes}\n\nOutline:\n{outline_text(outline)}\n\n"
            f"Concepts earlier chapters already taught:\n{taught}\n\n"
            f"Write chapter [{ch.key}] \"{ch.title}\": {ch.summary}\nIt teaches:\n{own or '(see the summary)'}"
        )

    async def write_chapter(self, outline: CourseOutline, ch: ChapterSpec, notes: str, counter: dict) -> None:
        out, left = await self.checked(
            "chapters", system=config.prompt("writer") + "\n\n" + rules(),
            user=self.chapter_prompt(outline, ch, notes), schema=ChapterOut, max_tokens=8000,
            problems=lambda o: chapter_problems(tidy(o, ch.title), ch.title), previous=lambda o: o.markdown,
        )
        out = tidy(out, ch.title)
        if left:
            log.info("chapter %s kept with problems after a retry: %s", ch.key, left)
        self.write_chapter_files(ch.key, out)
        counter["done"] += 1
        await self.emit("chapters", f"Wrote {ch.title}", {"chapter": ch.title, "done": counter["done"], "total": counter["total"]})

    async def chapters(self, outline: CourseOutline, notes: str) -> None:
        chapters = [ch for m in outline.modules for ch in m.chapters]
        todo = [ch for ch in chapters if not self.chapter_done(ch.key)]
        counter = {"done": len(chapters) - len(todo), "total": len(chapters)}
        if not todo:
            return
        await self.emit("chapters", f"Writing {len(todo)} chapters", {"done": counter["done"], "total": counter["total"]})
        await gather_limited([lambda ch=ch: self.write_chapter(outline, ch, notes, counter) for ch in todo],
                             CHAPTER_CONCURRENCY, self.check_cancel)

    def diagram_requests(self, outline: CourseOutline) -> list[tuple[ChapterSpec, DiagramRequest]]:
        """The chapters that asked for a picture, at most half the course."""
        chapters = [ch for m in outline.modules for ch in m.chapters]
        asked = []
        for ch in chapters:
            side = self.course / "chapters" / f"{ch.key}.json"
            try:
                ex = _load_json(side, ChapterExtras) if side.exists() else None
            except MaterialiseError:
                ex = None
            if ex and ex.diagramRequest:
                asked.append((ch, ex.diagramRequest))
        return asked[: math.ceil(len(chapters) / 2)]

    async def draw(self, ch: ChapterSpec, req: DiagramRequest) -> None:
        from app.agents.diagrammer import DiagramSaver, make_movie, make_mermaid

        d = self.course / "diagrams"
        if (d / f"{ch.key}.flow").exists() or (d / f"{ch.key}.mmd").exists():
            return
        md = (self.course / "chapters" / f"{ch.key}.md").read_text()
        spec = f"{req.title or ch.title}\n\n{req.show}"
        if req.shape == "process":
            result = await make_movie(spec, context=md[:4000])
        else:
            result = await make_mermaid(spec, context=md[:4000])
        self.ledger.add("diagrams", result.get("usage") or {})
        await self.ledger.save()
        saved = DiagramSaver(self.course).save(ch.key, result["kind"], req.title or result["title"], result["source"])
        if saved.startswith("Saved"):
            what = "a movie" if result["kind"] == "flow" else "a diagram"
            await self.emit("chapters", f"Drew {what} for {ch.title}", {"diagram": ch.title, "kind": result["kind"]})
        else:
            log.info("diagram for %s not saved: %s", ch.key, saved)

    async def diagrams(self, outline: CourseOutline) -> None:
        asked = self.diagram_requests(outline)
        if asked:
            await gather_limited([lambda c=c, r=r: self.draw(c, r) for c, r in asked], 3, self.check_cancel)

    def project_done(self, key: str) -> bool:
        p = self.course / "projects" / f"{key}.json"
        try:
            return p.exists() and bool(_load_json(p, ProjectSpec))
        except MaterialiseError:
            return False

    async def project(self, outline: CourseOutline, mi: int) -> None:
        m = outline.modules[mi]
        prev = next((outline.modules[i] for i in range(mi - 1, -1, -1) if outline.modules[i].projectKey), None)
        prev_title = ""
        if prev and self.project_done(prev.projectKey or ""):
            prev_title = _load_json(self.course / "projects" / f"{prev.projectKey}.json", ProjectSpec).title
        chapters = "\n".join(f"- [{ch.key}] {ch.title}: {ch.summary}" for ch in m.chapters)
        spec = await self.call(
            "projects", system=config.prompt("project_designer") + "\n\n" + rules(),
            user=(
                f"{brief_text(self.brief)}\n\nOutline:\n{outline_text(outline)}\n\n"
                f"Design the project for module {mi + 1} \"{m.title}\". Its chapters:\n{chapters}\n"
                + (f"\nIt builds on the previous module's project: {prev_title}\n" if prev_title else "")
            ),
            schema=ProjectSpec, max_tokens=6000,
        )
        keys = {ch.key for mm in outline.modules for ch in mm.chapters}
        for r in spec.rubric:
            if r.chapterKey and r.chapterKey not in keys:
                r.chapterKey = None
        (self.course / "projects" / f"{m.projectKey}.json").write_text(spec.model_dump_json(indent=2))
        await self.emit("projects", f"Designed {spec.title}", {"projects": [spec.title]})

    async def projects(self, outline: CourseOutline) -> None:
        todo = [i for i, m in enumerate(outline.modules) if m.projectKey and not self.project_done(m.projectKey)]
        if todo:
            await self.emit("projects", "Designing the projects", {})
            for i in todo:  # in order: each builds on the one before
                await self.check_cancel()
                await self.project(outline, i)

    async def review(self, outline: CourseOutline, notes: str) -> None:
        marker = self.course / "review.json"
        if marker.exists():
            return
        await self.emit("projects", "Reviewing the course", {})
        parts = []
        for ch in (c for m in outline.modules for c in m.chapters):
            md = (self.course / "chapters" / f"{ch.key}.md").read_text()
            ex = _load_json(self.course / "chapters" / f"{ch.key}.json", ChapterExtras)
            qs = "\n".join(
                f"Q: {q.prompt} | options: {' / '.join(q.options)} | answer: {q.options[q.answer]}" for q in ex.questions
            )
            parts.append(f"=== [{ch.key}] ===\n{md}\n{qs}")
        out = await self.call(
            "review", system=config.prompt("reviewer") + "\n\n" + rules(),
            user=f"{brief_text(self.brief)}\n\nOutline:\n{outline_text(outline)}\n\nChapters:\n\n" + "\n\n".join(parts),
            schema=ReviewOut, max_tokens=4000,
        )
        by_key = {ch.key: ch for m in outline.modules for ch in m.chapters}
        # Chapters still failing the code checks (kept after their retry) go first, then the review's.
        flagged: dict[str, str] = {}
        for key, ch in by_key.items():
            md = (self.course / "chapters" / f"{key}.md").read_text()
            ex = _load_json(self.course / "chapters" / f"{key}.json", ChapterExtras)
            found = chapter_problems(tidy(ChapterOut(markdown=md, questions=ex.questions), ch.title), ch.title)
            if found:
                flagged[key] = " ".join(found)
        for b in out.blocking:
            if b.chapterKey in by_key:
                flagged[b.chapterKey] = (flagged.get(b.chapterKey, "") + " " + b.problem).strip()
        fixes = [Blocking(chapterKey=k, problem=v) for k, v in flagged.items()][:MAX_FIXES]
        if fixes:
            await self.emit("projects", f"Fixing {len(fixes)} chapter(s) the review flagged", {})
            await gather_limited([lambda b=b: self.fix(outline, by_key[b.chapterKey], b.problem, notes) for b in fixes],
                                 CHAPTER_CONCURRENCY, self.check_cancel)
        marker.write_text(out.model_dump_json(indent=2))

    async def fix(self, outline: CourseOutline, ch: ChapterSpec, problem: str, notes: str) -> None:
        md = (self.course / "chapters" / f"{ch.key}.md").read_text()
        ex = _load_json(self.course / "chapters" / f"{ch.key}.json", ChapterExtras)
        out, left = await self.checked(
            "fixes", system=config.prompt("writer") + "\n\n" + rules(),
            user=(
                self.chapter_prompt(outline, ch, notes)
                + f"\n\nThe chapter is written; a reviewer found this problem:\n{problem}\n\nCurrent chapter:\n{md}\n\n"
                "Current questions:\n" + json.dumps([q.model_dump() for q in ex.questions])
                + "\n\nReturn the whole chapter with the problem fixed, changing nothing else."
            ),
            schema=ChapterOut, max_tokens=8000, problems=lambda o: chapter_problems(tidy(o, ch.title), ch.title),
            previous=lambda o: o.markdown,
        )
        out = tidy(out, ch.title)
        if not left:  # never replace a chapter with a worse one
            out.diagramRequest = ex.diagramRequest
            self.write_chapter_files(ch.key, out)

    async def write(self, outline: CourseOutline) -> None:
        notes = self.research_notes()
        budget = config.build_token_budget()
        await self.chapters(outline, notes)
        await self.check_cancel()
        if self.ledger.total < budget:
            await self.diagrams(outline)
        await self.check_cancel()
        await self.projects(outline)
        await self.check_cancel()
        if self.ledger.total < budget:
            await self.review(outline, notes)
        else:
            await self.emit("projects", "Past the token budget: saving the course without a review pass", {})


def save_outline(workdir: Path, outline: CourseOutline) -> None:
    course = Path(workdir) / "course"
    course.mkdir(parents=True, exist_ok=True)
    data = outline.model_dump(by_alias=True)
    (course / "outline.json").write_text(json.dumps(data, indent=2))
    (course / "graph.json").write_text(json.dumps({"concepts": data["concepts"], "edges": data["edges"]}, indent=2))


async def gather_limited(factories: list[Callable[[], Awaitable]], limit: int,
                         between: Callable[[], Awaitable] | None = None) -> list:
    """Run coroutine factories at most `limit` at a time; `between` (the cancel check) runs before each.
    The first failure cancels the rest and is raised as itself (a Cancelled stays a Cancelled)."""
    sem = asyncio.Semaphore(limit)

    async def one(f):
        async with sem:
            if between:
                await between()
            return await f()

    try:
        async with asyncio.TaskGroup() as tg:
            tasks = [tg.create_task(one(f)) for f in factories]
    except BaseExceptionGroup as eg:
        raise eg.exceptions[0] from None
    return [t.result() for t in tasks]
