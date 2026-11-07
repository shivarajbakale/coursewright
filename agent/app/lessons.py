"""Correcting a lesson in place: its text and any of its questions. Used by PATCH /chapters/:id and the
accuracy job (app/jobs/accuracy.py). Ids never change, so progress, notes and answers stay attached; the
build folder's copy is updated too, so a later extension or backfill starts from the corrected text."""

from __future__ import annotations

import json

from app import config, inkling
from app.db import db, jdump, row, tx
from app.materialise import _reading_minutes


def problems(title: str, markdown: str | None, questions: list[dict], known_ids: set[str]) -> list[str]:
    """Why an edit can't be saved; empty when it can."""
    out = []
    if markdown is not None:
        if not markdown.strip().startswith(f"# {title}"):
            out.append(f"The lesson must start with `# {title}`")
        bad = inkling.markdown_problems(markdown)
        if bad:
            out.append("A drawing has problems: " + "; ".join(bad[:5]))
    for q in questions:
        if q["id"] not in known_ids:
            out.append(f"Question {q['id']} is not in this lesson")
        elif not 2 <= len(q["options"]) <= 5 or not 0 <= q["answer"] < len(q["options"]):
            out.append(f"Question {q['id']} needs 2-5 options and an answer among them")
    return out


def _files(conn, course_id: str, title: str):
    p = row(conn, "SELECT workdir FROM course_plans WHERE course_id=?", (course_id,))
    if not p or not p["workdir"]:
        return None
    folder = config.jobs_dir() / p["workdir"] / "course" / "chapters"
    if not folder.is_dir():
        return None
    for md in folder.glob("*.md"):
        if md.read_text().split("\n", 1)[0].strip() == f"# {title}":
            return md, md.with_suffix(".json")
    return None


def apply(chapter_id: str, markdown: str | None, questions: list[dict]) -> str | None:
    """Save a checked edit. Returns the lesson's tutor source id (to re-index), or None."""
    with db() as conn, tx(conn):
        ch = row(conn, "SELECT course_id, title, reading_minutes FROM chapters WHERE id=?", (chapter_id,))
        old = {r["id"]: r["prompt"] for r in conn.execute("SELECT id, prompt FROM questions WHERE chapter_id=?", (chapter_id,))}
        files = _files(conn, ch["course_id"], ch["title"])
        if markdown is not None:
            md = markdown.strip() + "\n"
            conn.execute("UPDATE chapters SET markdown=?, reading_minutes=? WHERE id=?",
                         (md, _reading_minutes(md, ch["reading_minutes"]), chapter_id))
            if files:
                files[0].write_text(md)
        for q in questions:
            conn.execute("UPDATE questions SET prompt=?, options=?, answer=?, explanation=? WHERE id=?",
                         (q["prompt"], jdump(q["options"]), q["answer"], q.get("explanation", ""), q["id"]))
        if files and questions and files[1].exists():
            extras = json.loads(files[1].read_text())
            by_prompt = {old[q["id"]]: q for q in questions if q["id"] in old}
            for i, spec in enumerate(extras.get("questions", [])):
                q = by_prompt.get(spec.get("prompt"))
                if q:
                    extras["questions"][i] = {**spec, "prompt": q["prompt"], "options": q["options"],
                                              "answer": q["answer"], "explanation": q.get("explanation", "")}
            files[1].write_text(json.dumps(extras, indent=2))
        src = row(conn, "SELECT id FROM sources WHERE kind='chapter' AND ref_id=?", (chapter_id,))
    return src["id"] if src else None
