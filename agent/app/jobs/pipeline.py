"""The course build pipeline: plain code runs the stages in order, one structured model call per artifact.

Every course starts from zero and teaches one concept per lesson (prompts/curriculum.md, writer.md; the
rules code checks live in app/jobs/pedagogy.py and are the same ones evals/teaching.py measures).

Plan phase (one job):
    research   one call: notes, terms, references          -> research/notes.md, research/refs.json
    curriculum one call: a concept map worked backwards from the goal to the floor, one lesson per concept,
               in an order where every prerequisite comes first; checked in code (size, order, first lesson
               has no prerequisites, titles "<concept>: <plain words>", nothing that assumes experience),
               two retries carrying the problems; code then builds the outline (course/outline.json)
    pause      with the brief's `reviewOutline`, the job ends here and the learner reshapes the outline
               (api/plans.py); approving it queues a writing job on the same folder

Write phase:
    chapters   every lesson side by side, eight at a time. The plan fixed each lesson's concept and supporting
               terms, so a lesson knows the terms the learner has met before any earlier lesson is written; it
               never sees the learner's level or the whole outline, only a context pack (what it builds on,
               the known terms, the research notes that concern it). Checked in code (length, one key idea, a
               wrap-up, no term before it is taught, no name a later lesson teaches, its planned terms
               explained), one retry; then a beginner reader marks where a newcomer gets stuck and answers
               the questions blind; a lesson with sticking points is revised once and kept only if it reads
               easier. Every lesson gets a "Your map so far" diagram drawn by code.
    verify     per lesson, one call works through its numbers, code and answer keys; a lesson with a mistake
               is revised from its draft
    explainers per lesson, one Inkling drawing (sometimes two) of its idea, its layout chosen from the idea,
               placed as an ```inkling fence after the paragraph it pictures (app/jobs/explainers.py)
    diagrams   movies for at most a quarter of the lessons, when the writer asked for one
    projects   one call per module

Every stage skips work whose files are already on disk and valid, so a stopped build continues where it
was. Tokens are counted per stage (`Ledger`) and kept on the job.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Awaitable, Callable, TypeVar

from pydantic import BaseModel, Field, field_validator

from app import config, inkling
from app.agents import llm
from app.jobs import pedagogy, store
from app.materialise import (
    ChapterExtras,
    ChapterSpec,
    CourseOutline,
    MANTINE_COLOURS,
    DiagramRequest,
    DiagramSpec,
    MaterialiseError,
    ProjectSpec,
    QuestionSpec,
    _load_json,
)

log = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

MAX_CHAPTERS = 90  # one concept per lesson: a three-month course is 60-85 short lessons
MIN_CHAPTERS = 12
CHAPTER_WORDS = (250, 800)  # the prompt asks for 350-650; outside this a lesson is sent back once
MAX_DEFINES = 4  # the lesson's concept and at most three small supporting terms
MAX_FIXES = 8
CHAPTER_CONCURRENCY = 8  # lessons no longer wait for each other: their terms are fixed in the plan
WRAP_UP = "## What you have now"
READ_ROUNDS = 1  # revisions after the beginner reader, each read again
BANNED = re.compile(r"\b(simply|obviously|trivially)\b|\bit is easy to see\b", re.I)
KEY_IDEA = "> **Key idea:**"
NOT_AN_ISSUE = re.compile(r"\bno (error|issue|mistake)s?\b|\b(is|are|looks) (correct|fine)\.?$|— correct\b", re.I)


# ---- model output shapes ----------------------------------------------------------------------------


class Reference(BaseModel):
    title: str
    url: str = ""


class ResearchOut(BaseModel):
    notes: str
    terms: list[str] = []
    references: list[Reference] = []


class Term(BaseModel):
    term: str
    meaning: str = ""


class ChapterOut(BaseModel):
    markdown: str
    defines: list[Term] = []
    uses: list[str] = []
    questions: list[QuestionSpec] = []
    diagramRequest: DiagramRequest | None = None

    @field_validator("defines", mode="before")
    @classmethod
    def _terms(cls, v):
        """A bare string is a term with no meaning given."""
        return [{"term": t} if isinstance(t, str) else t for t in (v or [])]

    @field_validator("uses", mode="before")
    @classmethod
    def _uses(cls, v):
        if isinstance(v, str):
            return [t.strip() for t in v.split(",") if t.strip()]
        return [t.get("term", "") if isinstance(t, dict) else str(t) for t in (v or [])]


class LessonPlan(BaseModel):
    key: str
    name: str = Field(description="The concept's name, at most 5 words")
    plain: str = Field(description="What it is, in at most 9 everyday words, lower case")
    summary: str = ""
    prerequisites: list[str] = []
    terms: list[str] = Field(default=[], description="0-3 small supporting terms this lesson also explains")


class ModulePlan(BaseModel):
    title: str
    summary: str = ""
    project: bool = True
    lessons: list[LessonPlan]


class CurriculumOut(BaseModel):
    title: str
    summary: str = ""
    colour: str = "indigo"
    floor: str = ""
    modules: list[ModulePlan]


class Stuck(BaseModel):
    quote: str
    why: str = ""


class ReaderOut(BaseModel):
    """The beginner reader: where a newcomer gets stuck, and their blind answers to the questions."""

    stuck: list[Stuck] = []
    answers: list[int] = []

    @field_validator("stuck", mode="before")
    @classmethod
    def _stuck(cls, v):
        return [{"quote": s} if isinstance(s, str) else s for s in (v or [])]


class VerifyOut(BaseModel):
    issues: list[str] = []

    @field_validator("issues", mode="before")
    @classmethod
    def _flatten(cls, v):
        """Some models return each issue as an object ({"quote": ..., "fix": ...}); keep its words."""
        if isinstance(v, str):
            return [v] if v.strip() else []
        out = []
        for item in v or []:
            out.append(" ".join(str(x) for x in item.values()) if isinstance(item, dict) else str(item))
        # A model that shows its work lists checks that passed too; those are not mistakes.
        return [i for i in out if i.strip() and not NOT_AN_ISSUE.search(i)]


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
    """A rough cost to write this outline, from measured builds (MiniMax-M3, 65 lessons: 4.0M): per lesson a
    draft, beginner reads, up to two revisions and a check of numbers and code; a few movies; projects."""
    chapters = sum(len(m.chapters) for m in outline.modules)
    projects = sum(1 for m in outline.modules if m.projectKey)
    return chapters * 52_000 + math.ceil(chapters / 4) * 12_000 + projects * 8_000 + 40_000


# ---- checks in code ---------------------------------------------------------------------------------


def _taught_at(outline: CourseOutline) -> dict[str, int]:
    """concept key -> index of the first chapter that teaches it."""
    out: dict[str, int] = {}
    for i, ch in enumerate(ch for m in outline.modules for ch in m.chapters):
        for k in ch.conceptKeys:
            out.setdefault(k, i)
    return out


def outline_problems(outline: CourseOutline) -> list[str]:
    """What is wrong with an outline (as built from the curriculum or reshaped in the outline chat)."""
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
    for ch in chapters:
        if len(ch.conceptKeys) != 1:
            problems.append(f"Chapter {ch.key} teaches {len(ch.conceptKeys)} concepts; each chapter teaches exactly one.")
        concept = names.get(ch.conceptKeys[0]) if len(ch.conceptKeys) == 1 else None
        problems += pedagogy.title_problems(ch.title, concept)
    for m in outline.modules:
        problems += pedagogy.module_title_problems(m.title)
    problems += [f"The course summary assumes experience: {s}" for s in pedagogy.assumes_experience(outline.summary)]
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


def _slug(s: str, n: int = 40) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:n].strip("-") or "x"


def curriculum_problems(cur: CurriculumOut, pace: str = "") -> list[str]:
    """The concept map, checked before it becomes an outline: size (to the pace), one concept per lesson in
    an order where every prerequisite comes first, plain titles that name the concept, nothing assumed."""
    problems = []
    lessons = [ls for m in cur.modules for ls in m.lessons]
    lo, hi = pedagogy.pace_lessons(pace)
    lo, hi = max(MIN_CHAPTERS, lo), min(MAX_CHAPTERS, hi)
    if not lo <= len(lessons) <= hi:
        problems.append(
            f"The course has {len(lessons)} lessons; this pace needs {lo}-{hi}. "
            + ("Split concepts that hold more than one idea and add the steps a newcomer needs between them"
               if len(lessons) < lo else "Merge or drop the least needed lessons")
            + ", and count them again before you answer."
        )
    seen: dict[str, int] = {}
    for i, ls in enumerate(lessons):
        key = _slug(ls.key)
        if key in seen:
            problems.append(f"Two lessons share the key {ls.key}: each concept is taught once.")
        seen.setdefault(key, i)
    later_names = {_slug(ls.key): ls.name for ls in lessons}
    for i, ls in enumerate(lessons):
        for p in ls.prerequisites:
            j = seen.get(_slug(p))
            if j is None:
                problems.append(f'Lesson "{ls.name}" lists the prerequisite {p}, which no lesson teaches.')
            elif j >= i:
                problems.append(
                    f'Lesson "{ls.name}" builds on "{lessons[j].name}", which comes after it: move it later, '
                    "or its prerequisite earlier."
                )
        title = pedagogy.lesson_title(ls.name, ls.plain)
        problems += pedagogy.title_problems(title, ls.name) + pedagogy.concept_name_problems(ls.name)
        if len(ls.terms) > 3:
            problems.append(f'Lesson "{ls.name}" plans {len(ls.terms)} supporting terms; at most 3.')
        for t in ls.terms:
            j = next((j for j, x in enumerate(lessons) if pedagogy._norm(x.name) == pedagogy._norm(t)), None)
            if j is not None and j > i:
                problems.append(f'Lesson "{ls.name}" plans to explain "{t}", which is a later lesson\'s concept.')
        later = [later_names[_slug(x.key)] for x in lessons[i + 1:] if _slug(x.key) != _slug(ls.key)]
        # A title is held to every later name, not only the distinctive ones: "Next token prediction" before
        # "Tokens" is a lesson that needs a later one.
        for t in later:
            if pedagogy.mentions(f"{ls.name} {ls.plain}", t):
                problems.append(
                    f'"{title}" uses "{t}", which a later lesson teaches: teach "{t}" first, or use words the '
                    "learner knows."
                )
    orphans = [ls.name for ls in lessons[1:] if not ls.prerequisites]
    if orphans:
        problems.append(
            f"{len(orphans)} lessons list no prerequisites ({', '.join(orphans[:6])}{'...' if len(orphans) > 6 else ''}): "
            "every lesson after the first builds on at least one earlier lesson; list the keys of the ones it uses."
        )
    if lessons and lessons[0].prerequisites:
        problems.append(f'The first lesson, "{lessons[0].name}", has prerequisites: the course must start from zero.')
    for m in cur.modules:
        problems += pedagogy.module_title_problems(m.title)
    for text in [cur.summary] + [ls.summary for ls in lessons]:
        problems += [f"This assumes experience instead of teaching: {s}" for s in pedagogy.assumes_experience(text)]
    return problems


def _title(ls: LessonPlan) -> str:
    """`<name>: <plain words>`; when the plain words still break the rules after the retries, the bare
    concept name, which always names what the lesson teaches."""
    title = pedagogy.lesson_title(ls.name, ls.plain)
    return title if not pedagogy.title_problems(title, ls.name) else ls.name.strip()


def to_outline(cur: CurriculumOut, topic: str = "", projects: bool = True) -> CourseOutline:
    """One chapter per concept, its title built from the concept's name and plain words. Prerequisites that
    point at a later or unknown lesson are dropped (the order is what the course honours)."""
    lessons = [ls for m in cur.modules for ls in m.lessons]
    keys: dict[str, str] = {}
    concepts = []
    for ls in lessons:
        k = _slug(ls.key)
        if k in keys:
            continue
        keys[k] = k
        terms = [t.strip() for t in ls.terms if t.strip() and pedagogy._norm(t) != pedagogy._norm(ls.name)][:3]
        concepts.append({"key": k, "name": ls.name.strip(), "summary": ls.summary.strip(), "terms": terms})
    order = {c["key"]: i for i, c in enumerate(concepts)}
    edges, seen_edges = [], set()
    for ls in lessons:
        to = _slug(ls.key)
        for p in ls.prerequisites:
            fr = _slug(p)
            if fr in order and order[fr] < order[to] and (fr, to) not in seen_edges:
                seen_edges.add((fr, to))
                edges.append({"from": fr, "to": to})
    modules, n, done = [], 0, set()
    for mi, m in enumerate(cur.modules, start=1):
        chapters = []
        for ls in m.lessons:
            k = _slug(ls.key)
            if k in done:
                continue
            done.add(k)
            n += 1
            chapters.append({
                "key": f"c{n:02d}-{_slug(ls.key, 30)}", "title": _title(ls),
                "readingMinutes": 4, "conceptKeys": [k], "summary": ls.summary.strip(),
            })
        if chapters:
            modules.append({
                "key": f"m{mi}", "title": m.title.strip().rstrip("."), "summary": m.summary.strip(),
                "chapters": chapters,
                "projectKey": f"p{mi}-{_slug(m.title, 30)}" if (projects and m.project) else None,
            })
    colour = cur.colour if cur.colour in MANTINE_COLOURS and cur.colour not in ("dark", "gray") else "indigo"
    return CourseOutline.model_validate({
        "title": cur.title.strip(), "topic": topic, "summary": cur.summary.strip(), "colour": colour, "icon": "",
        "concepts": concepts, "edges": edges, "modules": modules,
    })


MAP_TITLE = "Your map so far"


def map_diagram(outline: CourseOutline, ch: ChapterSpec) -> DiagramSpec:
    """The concepts the learner has so far, this lesson's highlighted: drawn by code, no tokens."""
    chapters = [c for m in outline.modules for c in m.chapters]
    names = {c.key: c.name for c in outline.concepts}
    lessons = [(c.conceptKeys[0] if c.conceptKeys else c.key, names.get(c.conceptKeys[0], c.title) if c.conceptKeys else c.title)
               for c in chapters]
    edges = [(e.from_, e.to) for e in outline.edges]
    source = pedagogy.map_so_far(lessons, edges, chapters.index(ch))
    return DiagramSpec(kind="mermaid", title=MAP_TITLE, source=source)


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


# Problems a revision may add when it makes the lesson easier for a newcomer: form, not teaching.
SOFT_KINDS = {"the limit is", "is only", "questions", "What you have now", "new terms"}
PROBLEM_KINDS = (
    "must start with", "the limit is", "is only", "Key idea", "Remove these words", "quiz", "questions",
    "What you have now", "assumes", "before any lesson", "later lesson", "new terms", "own concept",
)


def problem_kind(problem: str) -> str:
    return next((k for k in PROBLEM_KINDS if k in problem), problem)


@dataclass
class LessonContext:
    """What a lesson is checked against: its concept, the terms the learner has met in earlier lessons,
    the distinctive names later lessons teach, and the field's vocabulary (to catch undeclared terms)."""

    concept: str
    glossary: pedagogy.Glossary
    later: list[str]
    vocabulary: list[str]
    planned: list[str] = field(default_factory=list)  # supporting terms the plan gave this lesson


def chapter_problems(out: ChapterOut, title: str, ctx: LessonContext | None = None) -> list[str]:
    md = out.markdown.strip()
    problems = []
    if not md.startswith("# "):
        problems.append(f"The markdown must start with `# {title}`.")
    words = word_count(md)
    lo, hi = CHAPTER_WORDS
    if words > hi:
        problems.append(f"The lesson is {words} words; the limit is {hi}. Teach only its one concept; cut, don't summarise.")
    elif words < lo:
        problems.append(f"The lesson is only {words} words; it needs 350-650 words of real teaching.")
    callouts = md.count(KEY_IDEA)
    if callouts != 1:
        problems.append(f"The lesson needs exactly one `{KEY_IDEA}` line; it has {callouts}.")
    if WRAP_UP not in md:
        problems.append(f"End with a `{WRAP_UP}` section joining this concept to the earlier ones.")
    banned = sorted({m.group(0).lower() for m in BANNED.finditer(md)})
    if banned:
        problems.append(f"Remove these words, and explain the step they skip instead: {', '.join(banned)}.")
    if re.search(r"^#+\s*(check yourself|quiz|questions)\b|^\**answer:\s*\d", md, re.I | re.M):
        problems.append("Remove the quiz from the markdown: questions belong only in `questions`.")
    if not 2 <= len(out.questions) <= 3:
        problems.append(f"Give 2-3 questions; there are {len(out.questions)}.")
    for s in pedagogy.assumes_experience(md):
        problems.append(f'This assumes the learner has done it before instead of teaching it: "{s}"')
    if ctx is None:
        return problems
    defined = [t.term for t in out.defines]
    known = pedagogy.Glossary.of(list(ctx.glossary.terms.values()) + defined + [ctx.concept])
    if not any(pedagogy._norm(ctx.concept) in pedagogy._norm(t) or pedagogy._norm(t) in pedagogy._norm(ctx.concept)
               for t in defined):
        problems.append(f'`defines` must start with the lesson\'s own concept, "{ctx.concept}".')
    missing = [t for t in ctx.planned if not pedagogy.Glossary.of(defined).knows(t) and not pedagogy.mentions(md, t)]
    if missing:
        problems.append(
            f"Explain {', '.join(missing)} in a sentence and add {'it' if len(missing) == 1 else 'them'} to `defines`: "
            "the plan gives this lesson that job and later lessons rely on it."
        )
    if len(defined) > MAX_DEFINES:
        problems.append(
            f"The lesson explains {len(defined)} new terms ({', '.join(defined)}); one concept per lesson means "
            f"at most {MAX_DEFINES}. Leave the extra ideas out or describe them in everyday words."
        )
    # Every field term it relies on was taught earlier or is explained here. A plain word the writer lists
    # ("function", "Python") is the floor, not a gap: only distinctive terms and the field's own count.
    field = pedagogy.Glossary.of(ctx.vocabulary)
    unknown = [u for u in known.unknown(out.uses) if pedagogy.is_distinctive(u) or field.knows(u)]
    # Terms of the field the prose uses without declaring them anywhere.
    for t in ctx.vocabulary:
        if pedagogy.is_distinctive(t) and pedagogy.mentions(md, t) and not known.knows(t) and t not in unknown:
            unknown.append(t)
    later = [t for t in pedagogy.future_terms(md, ctx.later) if not known.knows(t)]
    unknown = [u for u in unknown if u not in later]
    if unknown:
        problems.append(
            f"It uses {', '.join(unknown[:8])} before any lesson explained {'it' if len(unknown) == 1 else 'them'}: "
            "explain each in a sentence (and add it to `defines`) or say it in everyday words."
        )
    if later:
        problems.append(
            f"It names {', '.join(later[:8])}, which a later lesson teaches: describe what you need in plain "
            "words without the name, or leave it out."
        )
    return problems


def reader_prompt(before: list[str], markdown: str, questions: list[dict]) -> str:
    """What the beginner reader sees: the lessons already read, the lesson, its questions without the key."""
    qs = "\n".join(
        f"Q{i + 1}: {q.get('prompt')}\n" + "\n".join(f"  [{j}] {o}" for j, o in enumerate(q.get("options", [])))
        for i, q in enumerate(questions)
    )
    return (
        "Lessons you have already read:\n" + ("\n".join(before) or "(none: this is the first lesson)")
        + f"\n\nThe lesson:\n\n{markdown}\n\nQuestions:\n{qs or '(none)'}"
    )


# ---- context the stages share -----------------------------------------------------------------------


LEVEL_QUESTION = re.compile(r"\b(start|starting|level|experience|know|background|familiar|already|new to)\b", re.I)


def brief_text(brief: dict, *, level: bool = True) -> str:
    """The brief as lines. With `level=False` (the curriculum and every lesson), what the learner says about
    their experience is left out: it must never raise the floor or show in the text."""
    lines = [f"Topic: {brief.get('topic')}"]
    for k in ("level", "goal", "pace") if level else ("goal", "pace"):
        if brief.get(k):
            lines.append(f"{k.capitalize()}: {brief[k]}")
    for a in brief.get("answers") or []:
        if not level and LEVEL_QUESTION.search(a.get("question") or ""):
            continue
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
        best, best_found = out, found
        for _ in range(retries):
            if not found:
                break
            shown = f"\n\nYour previous draft:\n{previous(out)}\n\nRevise that draft" if previous else (
                "\n\nYour previous answer"
            )
            retry = user + shown + " to fix these problems, keeping everything else:\n" + "\n".join(f"- {p}" for p in found)
            try:
                out = await self.call(stage, system=system, user=retry, schema=schema, max_tokens=max_tokens)
            except store.Cancelled:
                raise
            except Exception as e:  # noqa: BLE001 - a retry that fails keeps the best answer so far
                log.warning("%s retry failed, keeping the best answer so far: %s", stage, e)
                break
            found = problems(out)
            if len(found) <= len(best_found):  # a retry can come back worse (cut short, half an answer)
                best, best_found = out, found
        return best, best_found

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
            "research", system=config.prompt("researcher") + "\n\n" + rules(), user=brief_text(self.brief, level=False),
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
        """The concept map, worked backwards from the goal to the floor, one lesson per concept; code checks
        the order, the size and the titles, asks again with the problems, then builds the outline itself."""
        existing = self.outline()
        if existing:
            return existing
        await self.emit("concepts", "Mapping the concepts from the basics up", {})
        cur, left = await self.checked(
            "curriculum",
            system=config.prompt("curriculum") + "\n\n" + rules(),
            user=f"{brief_text(self.brief, level=False)}\n\nResearch notes:\n{notes}",
            schema=CurriculumOut, max_tokens=20000, retries=2,
            problems=lambda c: curriculum_problems(c, self.brief.get("pace", "")),
            previous=lambda c: c.model_dump_json(),  # revise the map, don't redraw it from nothing
        )
        lessons = sum(len(m.lessons) for m in cur.modules)
        if lessons < MIN_CHAPTERS:
            # A cut-short answer, not a course: ask once more from scratch, then fail loudly (Continue retries).
            cur = await self.call(
                "curriculum", system=config.prompt("curriculum") + "\n\n" + rules(),
                user=f"{brief_text(self.brief, level=False)}\n\nResearch notes:\n{notes}", schema=CurriculumOut,
                max_tokens=20000,
            )
            lessons = sum(len(m.lessons) for m in cur.modules)
            if lessons < MIN_CHAPTERS:
                raise RuntimeError(f"the curriculum came back with {lessons} lessons; press Continue to plan again")
        outline = to_outline(cur, topic=self.brief.get("topic", ""))
        left = outline_problems(outline)
        if left:
            log.info("outline problems left after the retries, repaired in code where it can: %s", left)
            outline = repair_outline(outline)
        if cur.floor:
            (self.workdir / "research" / "floor.txt").write_text(cur.floor.strip() + "\n")
        self.save_outline(outline)
        await self.emit("concepts", f"Mapped {len(outline.concepts)} concepts", {"concepts": [c.name for c in outline.concepts]})
        chapters = sum(len(m.chapters) for m in outline.modules)
        await self.emit(
            "outline", f"Outlined {len(outline.modules)} modules, {chapters} lessons",
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

    def terms(self, key: str) -> dict:
        """What a written lesson declared (`defines`, `uses`) and what the beginner reader found."""
        p = self.course / "chapters" / f"{key}.terms.json"
        try:
            return json.loads(p.read_text()) if p.exists() else {}
        except json.JSONDecodeError:
            return {}

    def vocabulary(self, outline: CourseOutline) -> list[str]:
        p = self.workdir / "research" / "refs.json"
        try:
            terms = json.loads(p.read_text()).get("terms", []) if p.exists() else []
        except json.JSONDecodeError:
            terms = []
        return [str(t) for t in terms] + [c.name for c in outline.concepts]

    def context(self, outline: CourseOutline, ch: ChapterSpec) -> LessonContext:
        chapters = [c for m in outline.modules for c in m.chapters]
        i = chapters.index(ch)
        concepts = {c.key: c for c in outline.concepts}
        names = {k: c.name for k, c in concepts.items()}
        own = names.get(ch.conceptKeys[0], ch.title.split(":")[0]) if ch.conceptKeys else ch.title.split(":")[0]
        later = [names.get(k, k) for c in chapters[i + 1:] for k in c.conceptKeys if names.get(k, k) != own]
        planned = [t for k in ch.conceptKeys if k in concepts for t in concepts[k].terms]
        return LessonContext(concept=own, glossary=pedagogy.Glossary.of(self.known_terms(outline, ch)), later=later,
                             vocabulary=self.vocabulary(outline), planned=planned)

    def problems(self, outline: CourseOutline, ch: ChapterSpec, out: ChapterOut) -> list[str]:
        return chapter_problems(tidy(out, ch.title), ch.title, self.context(outline, ch))

    def write_chapter_files(self, outline: CourseOutline, ch: ChapterSpec, out: ChapterOut, read: dict | None = None) -> None:
        (self.course / "chapters" / f"{ch.key}.md").write_text(out.markdown.strip() + "\n")
        extras = ChapterExtras(questions=out.questions, diagramRequest=out.diagramRequest,
                               diagrams=[self.map_diagram(outline, ch)])
        (self.course / "chapters" / f"{ch.key}.json").write_text(extras.model_dump_json(indent=2, exclude_none=True))
        terms = {"defines": [t.model_dump() for t in out.defines], "uses": out.uses}
        if read is not None:
            terms["read"] = read
        (self.course / "chapters" / f"{ch.key}.terms.json").write_text(json.dumps(terms, indent=2))

    def map_diagram(self, outline: CourseOutline, ch: ChapterSpec) -> DiagramSpec:
        return map_diagram(outline, ch)

    def known_terms(self, outline: CourseOutline, ch: ChapterSpec) -> list[str]:
        """Every term the learner has met before this lesson: earlier concepts and the supporting terms the plan
        gave their lessons (fixed before any lesson is written, so lessons can be written side by side), plus
        anything a written lesson also defined."""
        chapters = [c for m in outline.modules for c in m.chapters]
        names = {c.key: c.name for c in outline.concepts}
        seen: dict[str, str] = {}
        planned = {c.key: c.terms for c in outline.concepts}
        for c in chapters[: chapters.index(ch)]:
            written = [d.get("term", "") for d in self.terms(c.key).get("defines", [])]
            for t in [names.get(k, k) for k in c.conceptKeys] + [t for k in c.conceptKeys for t in planned.get(k, [])] + written:
                if t.strip():
                    seen.setdefault(pedagogy._norm(t), t.strip())
        return list(seen.values())

    def builds_on(self, outline: CourseOutline, ch: ChapterSpec, limit: int = 6) -> list[ChapterSpec]:
        """The earlier lessons this one rests on: its prerequisites, then theirs, nearest first."""
        chapters = [c for m in outline.modules for c in m.chapters]
        by_concept = {k: c for c in chapters for k in c.conceptKeys}
        pre: dict[str, list[str]] = {}
        for e in outline.edges:
            pre.setdefault(e.to, []).append(e.from_)
        out: list[ChapterSpec] = []
        frontier = list(ch.conceptKeys)
        while frontier and len(out) < limit:
            nxt = []
            for k in frontier:
                for p in pre.get(k, []):
                    c = by_concept.get(p)
                    if c and c not in out and c is not ch and len(out) < limit:
                        out.append(c)
                        nxt.append(p)
            frontier = nxt
        return out

    def chapter_prompt(self, outline: CourseOutline, ch: ChapterSpec, notes: str) -> str:
        """What one lesson needs and nothing else: its concept, the lessons it builds on, the terms the learner
        knows, the notes that concern it, how the previous lesson ended and what the next one answers. Never
        the whole outline: later lessons' names are exactly what a lesson must not use."""
        chapters = [c for m in outline.modules for c in m.chapters]
        i = chapters.index(ch)
        concepts = {c.key: c for c in outline.concepts}
        module = next(m for m in outline.modules if ch in m.chapters)
        own = "\n".join(f"- {concepts[k].name} [{k}]: {concepts[k].summary}" for k in ch.conceptKeys if k in concepts)
        query = " ".join([ch.title, ch.summary] + [concepts[k].summary for k in ch.conceptKeys if k in concepts])
        picked = pedagogy.relevant_notes(notes, query) or "(none specific to this lesson)"
        base = "\n".join(f"- {c.title}: {c.summary}" for c in self.builds_on(outline, ch)) or "(nothing: it starts from the floor)"
        recent = "\n".join(f"- {c.title}" for c in chapters[max(0, i - 3): i])
        terms = self.known_terms(outline, ch)
        prev = ""
        if i:
            p = self.course / "chapters" / f"{chapters[i - 1].key}.md"
            if p.exists():
                text = p.read_text()
                at = text.find(WRAP_UP)
                prev = (text[at:] if at >= 0 else text[-800:]).strip()[:1200]
            prev = f"The previous lesson, \"{chapters[i - 1].title}\", ended:\n{prev or chapters[i - 1].summary}"
        nxt = ""
        if i + 1 < len(chapters):  # what it answers, without its name: a later name must not leak in
            after = chapters[i + 1].title.partition(":")
            nxt = f"The next lesson answers: {after[2].strip() or chapters[i + 1].summary}"
        support = [t for k in ch.conceptKeys if k in concepts for t in concepts[k].terms]
        floor = self.workdir / "research" / "floor.txt"
        return (
            f"{brief_text(self.brief, level=False)}\n"
            + (f"Floor: {floor.read_text().strip()}\n" if floor.exists() else "")
            + f"Course: {outline.title}. Module: {module.title}.\n\n"
            f"Research notes for this lesson:\n{picked}\n\n"
            f"It builds on these earlier lessons:\n{base}\n\n"
            + (f"The lessons just before it:\n{recent}\n\n" if recent else "")
            + f"Terms the learner knows from earlier lessons: {', '.join(terms) if terms else '(none: this is the first lesson)'}\n\n"
            + (f"{prev}\n\n" if prev else "")
            + (f"{nxt}\n\n" if nxt else "")
            + f"Write lesson [{ch.key}] \"{ch.title}\": {ch.summary}\nIts one concept:\n{own or '(see the summary)'}"
            + (f"\nIt also explains these supporting terms (later lessons rely on them): {', '.join(support)}" if support else "")
        )

    async def read_lesson(self, outline: CourseOutline, ch: ChapterSpec, out: ChapterOut) -> ReaderOut | None:
        """The beginner reader: a learner who knows only the earlier lessons reads this one."""
        chapters = [c for m in outline.modules for c in m.chapters]
        i = chapters.index(ch)
        terms = self.known_terms(outline, ch)
        before = [f"- {c.title}" for c in chapters[max(0, i - 3): i]]
        if terms:
            before.append(f"Terms those lessons and the ones before them explained: {', '.join(terms)}")
        try:
            return await self.call(
                "reader", system=config.prompt("beginner"),
                user=reader_prompt(before, out.markdown, [q.model_dump() for q in out.questions]),
                schema=ReaderOut, max_tokens=4000,
            )
        except store.Cancelled:
            raise
        except Exception as e:  # noqa: BLE001 - the lesson keeps its code checks; the reader is a second opinion
            log.warning("beginner reader on %s failed: %s", ch.key, e)
            return None

    async def write_chapter(self, outline: CourseOutline, ch: ChapterSpec, notes: str, counter: dict) -> None:
        """Draft (checked in code, one retry), then the beginner reader; a lesson they got stuck in, or that
        still fails a check, is revised from its draft and read again, up to READ_ROUNDS times, keeping a
        revision only when the newcomer gets stuck less often."""
        out, left = await self.checked(
            "chapters", system=config.prompt("writer") + "\n\n" + rules(),
            user=self.chapter_prompt(outline, ch, notes), schema=ChapterOut, max_tokens=8000,
            problems=lambda o: self.problems(outline, ch, o), previous=lambda o: o.markdown,
        )
        out = tidy(out, ch.title)
        read = await self.read_lesson(outline, ch, out)
        record: dict = {"firstStuck": len(read.stuck) if read else None, "revised": 0}
        for _ in range(READ_ROUNDS):
            if read is None:
                break
            found = self.reader_problems(out, read)
            if not found and not left:
                break
            try:
                revised = await self.revise(outline, ch, out, found + left, notes, soft_ok=True)
            except store.Cancelled:
                raise
            except Exception as e:  # noqa: BLE001 - a revision that fails leaves the checked draft
                log.warning("revision of %s failed, keeping the draft: %s", ch.key, e)
                break
            if revised is None:
                break
            again = await self.read_lesson(outline, ch, revised)
            if again is not None and len(again.stuck) >= len(read.stuck) and not (left and not found):
                break  # the revision didn't make it easier for the newcomer: keep the draft
            out, read, left = revised, again, self.problems(outline, ch, revised)
            record["revised"] += 1
            if again is None:
                break
        record["stuck"] = [x.model_dump() for x in read.stuck] if read else None
        record["left"] = self.problems(outline, ch, out)
        if record["left"]:
            log.info("lesson %s kept with problems: %s", ch.key, record["left"])
        self.write_chapter_files(outline, ch, out, record)
        counter["done"] += 1
        await self.emit("chapters", f"Wrote {ch.title}", {"chapter": ch.title, "done": counter["done"], "total": counter["total"]})

    @staticmethod
    def reader_problems(out: ChapterOut, read: ReaderOut) -> list[str]:
        found = [f'A newcomer got stuck at "{s.quote}": {s.why}' for s in read.stuck]
        wrong = [i + 1 for i, (q, a) in enumerate(zip(out.questions, read.answers)) if a != q.answer]
        if wrong:
            found.append(f"A newcomer who read only this lesson answered question(s) {wrong} wrongly: make the "
                         "lesson teach what they test, or make the question unambiguous.")
        return found

    async def revise(self, outline: CourseOutline, ch: ChapterSpec, out: ChapterOut, problems: list[str],
                     notes: str, stage: str = "revisions", soft_ok: bool = False) -> ChapterOut | None:
        """One revision from the draft. Kept unless it adds a kind of problem the draft didn't have; with
        `soft_ok` (the caller then judges it by the beginner reader), a new soft problem such as a few words
        over the length is allowed."""
        before = {problem_kind(p) for p in self.problems(outline, ch, out)}
        new, left = await self.checked(
            stage, system=config.prompt("writer") + "\n\n" + rules(),
            user=(
                self.chapter_prompt(outline, ch, notes)
                + "\n\nThe lesson is written; fix these problems. Where a newcomer got stuck on a term the lesson "
                "doesn't need, cut it or say it in everyday words; define a new term only when the concept needs "
                "it.\n" + "\n".join(f"- {p}" for p in problems)
                + f"\n\nCurrent lesson:\n{out.markdown}\n\nCurrent defines: {json.dumps([t.model_dump() for t in out.defines])}"
                + f"\nCurrent uses: {json.dumps(out.uses)}\nCurrent questions:\n"
                + json.dumps([q.model_dump() for q in out.questions])
                + "\n\nReturn the whole lesson with the problems fixed, keeping what works."
            ),
            schema=ChapterOut, max_tokens=8000, problems=lambda o: self.problems(outline, ch, o),
            previous=lambda o: o.markdown,
        )
        new = tidy(new, ch.title)
        added = {problem_kind(p) for p in left} - before
        if not added or (soft_ok and added <= SOFT_KINDS):
            if new.diagramRequest is None:
                new.diagramRequest = out.diagramRequest
            return new
        return None

    async def chapters(self, outline: CourseOutline, notes: str) -> None:
        """Every lesson side by side, CHAPTER_CONCURRENCY at a time in reading order. A lesson doesn't wait for
        the ones it builds on: the terms they explain are fixed in the plan, so it knows what the learner
        knows before any of them is written."""
        chapters = [ch for m in outline.modules for ch in m.chapters]
        todo = [ch for ch in chapters if not self.chapter_done(ch.key)]
        counter = {"done": len(chapters) - len(todo), "total": len(chapters)}
        if not todo:
            return
        await self.emit("chapters", f"Writing {len(todo)} lessons", {"done": counter["done"], "total": counter["total"]})
        await gather_limited([lambda ch=ch: self.write_chapter(outline, ch, notes, counter) for ch in todo],
                             CHAPTER_CONCURRENCY, self.check_cancel)

    def diagram_requests(self, outline: CourseOutline) -> list[tuple[ChapterSpec, DiagramRequest]]:
        """The lessons that asked for a movie, at most a quarter of the course (every lesson has its map)."""
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
        keep = asked[: math.ceil(len(chapters) / 4)]
        for ch, _ in asked[len(keep):]:  # beyond the cap: no request left that nothing will draw
            side = self.course / "chapters" / f"{ch.key}.json"
            ex = _load_json(side, ChapterExtras)
            side.write_text(ex.model_copy(update={"diagramRequest": None}).model_dump_json(indent=2, exclude_none=True))
        return keep


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

    def load_lesson(self, ch: ChapterSpec) -> ChapterOut:
        md = (self.course / "chapters" / f"{ch.key}.md").read_text()
        ex = _load_json(self.course / "chapters" / f"{ch.key}.json", ChapterExtras)
        t = self.terms(ch.key)
        return ChapterOut(markdown=md, questions=ex.questions, diagramRequest=ex.diagramRequest,
                          defines=t.get("defines", []), uses=t.get("uses", []))

    async def fix(self, outline: CourseOutline, ch: ChapterSpec, problem: str, notes: str) -> bool:
        out = self.load_lesson(ch)
        new = await self.revise(outline, ch, out, [problem], notes, stage="fixes")
        if new is None:
            return False
        self.write_chapter_files(outline, ch, new, self.terms(ch.key).get("read"))
        return True

    async def verify_chapter(self, outline: CourseOutline, ch: ChapterSpec, notes: str, tally: dict) -> None:
        """Work through one lesson (numbers, code, answer keys); revise it when something is wrong or it
        still fails the code checks. A marker file records that it was checked, so Continue skips it."""
        marker = self.course / "chapters" / f"{ch.key}.verified"
        if marker.exists():
            return
        lesson = self.load_lesson(ch)
        qs = "\n".join(
            f"Q{i + 1}: {q.prompt}\n" + "\n".join(f"  [{j}] {o}" for j, o in enumerate(q.options))
            + f"\n  answer: {q.answer}\n  explanation: {q.explanation}"
            for i, q in enumerate(lesson.questions)
        )
        try:
            out = await self.call(
                "verify", system=config.prompt("verifier"), user=f"{lesson.markdown}\n\nQuestions:\n{qs}",
                schema=VerifyOut, max_tokens=8000,
            )
        except store.Cancelled:
            raise
        except Exception as e:  # noqa: BLE001 - this lesson goes unchecked; the others carry on
            log.warning("verify %s failed: %s", ch.key, e)
            return
        # Accuracy mistakes are always worth a revision; a lesson that only still has a code problem was
        # already revised once when it was written.
        if out.issues:
            code = self.problems(outline, ch, lesson)
            tally["fixed"] += await self.fix(outline, ch, "\n".join(f"- {p}" for p in out.issues + code), notes)
        tally["checked"] += 1
        marker.write_text(json.dumps({"issues": out.issues}, indent=2))

    async def verify(self, outline: CourseOutline, notes: str) -> None:
        chapters = [ch for m in outline.modules for ch in m.chapters]
        todo = [ch for ch in chapters if not (self.course / "chapters" / f"{ch.key}.verified").exists()]
        if not todo:
            return
        await self.emit("chapters", f"Checking {len(todo)} chapters: numbers, code and answers", {})
        tally = {"checked": 0, "fixed": 0}
        await gather_limited([lambda ch=ch: self.verify_chapter(outline, ch, notes, tally) for ch in todo],
                             CHAPTER_CONCURRENCY, self.check_cancel)
        await self.emit("chapters", f"Checked {tally['checked']} chapters, corrected {tally['fixed']}", {})

    async def explain_chapter(self, outline: CourseOutline, ch: ChapterSpec, layouts, tally: dict) -> None:
        from app.jobs import explainers

        path = self.course / "chapters" / f"{ch.key}.md"
        marker = self.course / "chapters" / f"{ch.key}.explained"
        if marker.exists() or not path.exists() or inkling.fences(path.read_text()):
            return

        async def call(system: str, user: str):
            return await self.call("explainers", system=system, user=user, schema=explainers.ExplainersOut,
                                   max_tokens=6000)

        new, used = await explainers.explain(call, course=outline.title, title=ch.title, markdown=path.read_text(),
                                             layouts=layouts)
        if new:
            path.write_text(new)
            layouts.update(used)
            tally["added"] += 1
        marker.write_text(json.dumps({"layouts": used}))

    async def explainers(self, outline: CourseOutline) -> None:
        """One Inkling explainer per lesson, sometimes two, placed after the paragraph each pictures."""
        from collections import Counter

        chapters = [ch for m in outline.modules for ch in m.chapters]
        todo = [ch for ch in chapters if not (self.course / "chapters" / f"{ch.key}.explained").exists()]
        if not todo:
            return
        layouts: Counter = Counter()
        for ch in chapters:
            p = self.course / "chapters" / f"{ch.key}.md"
            if p.exists():
                layouts.update(f.layout for f in inkling.fences(p.read_text()))
        await self.emit("chapters", f"Drawing explainers for {len(todo)} chapters", {})
        tally = {"added": 0}
        await gather_limited([lambda ch=ch: self.explain_chapter(outline, ch, layouts, tally) for ch in todo],
                             CHAPTER_CONCURRENCY, self.check_cancel)
        await self.emit("chapters", f"Drew explainers for {tally['added']} chapters", {"layouts": dict(layouts)})

    async def optional(self, what: str, coro) -> None:
        """A polishing stage that fails (a provider error, an answer that won't validate) is logged and
        skipped: the course is complete without it. Cancelling still cancels."""
        try:
            await coro
        except store.Cancelled:
            raise
        except Exception as e:  # noqa: BLE001
            log.warning("%s skipped for job %s: %s", what, self.job_id, e, exc_info=True)
            await self.emit("chapters", f"Skipped {what} after an error; the course is complete without it", {})

    async def write(self, outline: CourseOutline) -> None:
        notes = self.research_notes()
        # Polishing stops at the configured budget or a third over this course's own estimate, whichever is
        # more: a long course is not cut short of its accuracy check for being long.
        budget = max(config.build_token_budget(), int(estimate_tokens(outline) * 1.35))
        await self.chapters(outline, notes)
        await self.check_cancel()
        if self.ledger.total < budget:
            await self.optional("the accuracy check", self.verify(outline, notes))
        await self.check_cancel()
        if self.ledger.total < budget:
            await self.optional("the explainers", self.explainers(outline))
        await self.check_cancel()
        if self.ledger.total < budget:
            await self.optional("the diagrams", self.diagrams(outline))
        await self.check_cancel()
        await self.projects(outline)


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
