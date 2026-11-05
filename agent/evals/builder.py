"""Builder eval: grade a built course folder (what the builder writes under data/jobs/<job_id>/course/).

1. Structural (no model): the folder parses with the strict materialise schema; every .flow movie compiles;
   counts of chapters, questions, diagrams, projects.
2. Rubric (LLM judge, claude-opus-5-5): coverage of the brief, prerequisite order, accuracy, chapter
   quality (key idea, worked example), question quality, diagram fit, project quality. Each 1-5 with reasons.

Default folder: the newest data/jobs/*/course; or pass --folder (the seed course works as a baseline:
--folder app/seed/raft)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from evals.common import Estimate, judge

MAX_COURSE_CHARS = 400_000  # ~100k tokens; the judge sees the whole course below this


def default_folder() -> Path | None:
    from app import config

    jobs = sorted(config.jobs_dir().glob("*/course/outline.json"), key=lambda p: p.stat().st_mtime, reverse=True)
    return jobs[0].parent if jobs else None


def estimate(folder: Path | None = None) -> list[Estimate]:
    chars = sum(len(p.read_text()) for p in folder.rglob("*") if p.is_file()) if folder and folder.exists() else 200_000
    tokens = min(chars, MAX_COURSE_CHARS) // 4 + 3_000
    return [Estimate("rubric judge (claude-opus-5-5, effort high)", 1, tokens, 6_000)]


class Criterion(BaseModel):
    name: Literal["coverage", "prerequisites", "accuracy", "chapters", "questions", "diagrams", "projects"]
    score: int  # 1-5
    reasons: str
    worst_example: str


class Rubric(BaseModel):
    criteria: list[Criterion]
    blocking_problems: list[str]
    overall: int  # 1-5
    verdict: Literal["ship", "fix", "rebuild"]


JUDGE_SYSTEM = """You review a generated personal course before a learner sees it. Grade each criterion 1-5
(5 = an expert teacher would ship it unchanged) with concrete reasons and the single worst example (file and
quote):
- coverage: the outline covers what the brief and topic need, at the right depth for the level;
- prerequisites: no concept is used before the chapter that teaches it; the concept graph is sensible;
- accuracy: technical content is correct; subtle points are stated plainly;
- chapters: each has one key-idea callout, a real explanation and a worked example; no filler;
- questions: test understanding, one right answer, plausible distractors, explanations that teach;
- diagrams: each diagram fits its chapter; movies (.flow) show a process step by step and match the text;
- projects: milestones are concrete, checkable, ordered, and tied to the chapters.
List blocking problems (things that must be fixed before a learner sees it). verdict: ship / fix / rebuild."""


def structural(folder: Path) -> dict:
    from app import flowmovie
    from app.materialise import MaterialiseError, parse_course_folder

    out: dict = {"folder": str(folder)}
    try:
        parsed = parse_course_folder(folder)
    except MaterialiseError as e:
        return {**out, "parses": False, "error": str(e)}
    diagrams = [d for ex in parsed.extras.values() for d in ex.diagrams]
    flows = [d for d in diagrams if d.kind == "flow"]
    flow_errors = {}
    for i, d in enumerate(flows):
        r = flowmovie.check(d.source)
        if not r["ok"]:
            flow_errors[d.title or f"flow {i}"] = r["errors"][:3]
    chapters = len(parsed.chapters)
    return {
        **out,
        "parses": True,
        "modules": len(parsed.outline.modules),
        "chapters": chapters,
        "questions": sum(len(ex.questions) for ex in parsed.extras.values()),
        "diagrams": {"flow": len(flows), "mermaid": sum(d.kind == "mermaid" for d in diagrams)},
        "chaptersWithDiagram": sum(bool(ex.diagrams) for ex in parsed.extras.values()),
        "flowErrors": flow_errors,
        "projects": len(parsed.projects),
        "keyIdeaCallouts": sum("> **Key idea:**" in md for md in parsed.chapters.values()),
    }


def course_text(folder: Path) -> str:
    parts = []
    for p in sorted(folder.rglob("*")):
        if p.is_file() and p.suffix in (".json", ".md", ".flow", ".mmd"):
            parts.append(f"=== {p.relative_to(folder)} ===\n{p.read_text()}")
    text = "\n\n".join(parts)
    return text[:MAX_COURSE_CHARS] + ("\n\n[truncated]" if len(text) > MAX_COURSE_CHARS else "")


async def run(folder: Path | None = None) -> dict:
    folder = folder or default_folder()
    if folder is None or not (folder / "outline.json").exists():
        raise SystemExit("No built course folder found: pass --folder <path to a course folder with outline.json>.")
    s = structural(folder)
    print(json.dumps(s, indent=2))
    if not s["parses"]:
        return {"summary": {"verdict": "rebuild", "structural": s}, "results": []}
    brief = ""
    job_input = folder.parent / "brief.json"
    if job_input.exists():
        brief = job_input.read_text()
    rubric, usage = await judge(
        system=JUDGE_SYSTEM,
        user=(f"Brief:\n{brief or '(not recorded; infer the audience from the outline)'}\n\nCourse files:\n\n{course_text(folder)}"),
        schema=Rubric,
        max_tokens=12000,
    )
    from evals.common import actual_cost

    for c in rubric.criteria:
        print(f"  {c.name:<14} {c.score}/5  {c.reasons[:120]}")
    print(f"  overall {rubric.overall}/5 -> {rubric.verdict}")
    return {
        "summary": {"overall": rubric.overall, "verdict": rubric.verdict, "structural": s, "costUsd": round(actual_cost([usage]), 2)},
        "results": [rubric.model_dump()],
    }
