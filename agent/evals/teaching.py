"""Teaching eval: does a built course start from zero and go one concept at a time?

Code metrics (no model), from the same rules the pipeline enforces (app/jobs/pedagogy.py):
  lessons, words per lesson, concepts per lesson, titles that are not "<concept>: <plain words>",
  sentences that assume experience, references to lessons that come later, distinctive names of later
  concepts used early, prerequisites of the first lesson.
Beginner reader (one model call per lesson, prompts/beginner.md): a learner who knows only the titles of
the lessons before this one marks every place they get stuck, and answers the questions blind.

Both are run on the same folder shape the builder writes; `evals.export_course` turns a deployed course
into one, so an old course can be the baseline. `--no-reader` skips the model calls."""

from __future__ import annotations

import asyncio
import json
import re
import statistics
from pathlib import Path

from evals.common import Estimate


def _lessons(folder: Path) -> tuple[dict, list[dict]]:
    outline = json.loads((folder / "outline.json").read_text())
    names = {c["key"]: c["name"] for c in outline.get("concepts", [])}
    out = []
    for m in outline["modules"]:
        for ch in m["chapters"]:
            md = (folder / "chapters" / f"{ch['key']}.md").read_text()
            side = folder / "chapters" / f"{ch['key']}.json"
            extras = json.loads(side.read_text()) if side.exists() else {}
            out.append({
                "key": ch["key"], "title": ch["title"], "module": m["title"], "markdown": md,
                "questions": extras.get("questions", []),
                "concepts": [names.get(k, k) for k in ch.get("conceptKeys", [])],
            })
    return outline, out


def estimate(folder: Path | None) -> list[Estimate]:
    n = len(_lessons(folder)[1]) if folder and (folder / "outline.json").exists() else 14
    return [Estimate("beginner reader, one call per lesson", n, n * 3_500, n * 800)]


def code_metrics(folder: Path) -> dict:
    from app.jobs import pedagogy
    from app.jobs.pipeline import word_count

    outline, lessons = _lessons(folder)
    titles = [ls["title"] for ls in lessons]
    concept_at: dict[str, int] = {}
    for i, ls in enumerate(lessons):
        for c in ls["concepts"]:
            concept_at.setdefault(c, i)
    per: list[dict] = []
    for i, ls in enumerate(lessons):
        later_titles = titles[i + 1:]
        later_concepts = [c for c, j in concept_at.items() if j > i]
        md = ls["markdown"]
        per.append({
            "title": ls["title"],
            "words": word_count(md),
            "concepts": len(ls["concepts"]),
            "titleProblems": pedagogy.title_problems(ls["title"], ls["concepts"][0] if len(ls["concepts"]) == 1 else None),
            "assumes": pedagogy.assumes_experience(md),
            "forwardRefs": [t for t in later_titles if re.search(re.escape(t), md[len(ls["title"]) + 2:], re.I)],
            "futureTerms": pedagogy.future_terms(md, later_concepts),
        })
    first_prereqs = []
    if outline["modules"] and outline["modules"][0]["chapters"]:
        first = set(outline["modules"][0]["chapters"][0].get("conceptKeys", []))
        first_prereqs = [e["from"] for e in outline.get("edges", []) if e["to"] in first and e["from"] not in first]
    words = [p["words"] for p in per]
    return {
        "lessons": len(per),
        "modules": len(outline["modules"]),
        "wordsMedian": int(statistics.median(words)) if words else 0,
        "wordsMax": max(words, default=0),
        "readingMinutes": round(sum(words) / 220),
        "lessonsWithOneConcept": sum(p["concepts"] == 1 for p in per),
        "vagueTitles": sum(bool(p["titleProblems"]) for p in per),
        "assumesExperience": sum(len(p["assumes"]) for p in per),
        "forwardRefs": sum(len(p["forwardRefs"]) for p in per),
        "futureTerms": sum(len(p["futureTerms"]) for p in per),
        "firstLessonPrerequisites": len(first_prereqs),
        "perLesson": per,
    }


async def reader(folder: Path, limit: int | None = None) -> dict:
    from app import config
    from app.jobs.pipeline import ReaderOut, reader_prompt

    _, lessons = _lessons(folder)
    if limit:
        lessons = lessons[:limit]
    sem = asyncio.Semaphore(4)

    async def one(i: int, ls: dict):
        from app.agents import llm

        before = [f"- {x['title']}" for x in lessons[:i]] if i else []
        async with sem:
            out, usage = await llm.parse(
                system=config.prompt("beginner"), user=reader_prompt(before, ls["markdown"], ls["questions"]),
                schema=ReaderOut, max_tokens=4000,
            )
        right = sum(1 for q, a in zip(ls["questions"], out.answers) if q.get("answer") == a)
        return {"title": ls["title"], "stuck": len(out.stuck), "quotes": [s.quote[:120] for s in out.stuck][:8],
                "questions": len(ls["questions"]), "answeredRight": right, "usage": usage}

    results = await asyncio.gather(*(one(i, ls) for i, ls in enumerate(lessons)))
    stuck = [r["stuck"] for r in results]
    qs = sum(r["questions"] for r in results)
    return {
        "lessonsRead": len(results),
        "stuckTotal": sum(stuck),
        "stuckPerLesson": round(sum(stuck) / max(1, len(stuck)), 2),
        "stuckFirstLesson": stuck[0] if stuck else None,
        "lessonsWithNoStuck": sum(s == 0 for s in stuck),
        "blindAnswerRate": round(sum(r["answeredRight"] for r in results) / max(1, qs), 2),
        "tokens": sum(r["usage"].get("inputTokens", 0) + r["usage"].get("outputTokens", 0) for r in results),
        "perLesson": [{k: v for k, v in r.items() if k != "usage"} for r in results],
    }


async def run(folder: Path, with_reader: bool = True, limit: int | None = None) -> dict:
    code = code_metrics(folder)
    summary = {k: v for k, v in code.items() if k != "perLesson"}
    print(json.dumps(summary, indent=2))
    out = {"summary": {"folder": str(folder), **summary}, "results": [{"code": code}]}
    if with_reader:
        r = await reader(folder, limit)
        rs = {k: v for k, v in r.items() if k != "perLesson"}
        print(json.dumps(rs, indent=2))
        out["summary"]["reader"] = rs
        out["results"].append({"reader": r})
    return out
