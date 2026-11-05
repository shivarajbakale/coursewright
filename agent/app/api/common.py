"""Envelope, errors and the row -> wire-shape serializers shared by the routers."""

from __future__ import annotations

import sqlite3
from typing import Any

from fastapi import HTTPException

from app.db import jload, row, rows


def ok(data: Any) -> dict:
    return {"data": data}


def not_found(what: str = "Not found") -> HTTPException:
    return HTTPException(status_code=404, detail=what)


def need_claude() -> None:
    from app import config

    if not config.anthropic_key():
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY is not set")


# ---- courses ------------------------------------------------------------------------------------

_SUMMARY_SQL = """
SELECT c.*,
  (SELECT COUNT(*) FROM modules m WHERE m.course_id=c.id) AS module_count,
  (SELECT COUNT(*) FROM chapters ch WHERE ch.course_id=c.id) AS chapter_count,
  (SELECT COUNT(*) FROM projects p WHERE p.course_id=c.id) AS project_count,
  (SELECT cp.approved_at IS NULL FROM course_plans cp WHERE cp.course_id=c.id) AS plan_pending,
  (SELECT COUNT(*) FROM chapters ch JOIN progress pr ON pr.chapter_id=ch.id
     WHERE ch.course_id=c.id AND pr.finished_at IS NOT NULL) AS chapters_done
FROM courses c
"""


def course_summary(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "title": r["title"],
        "topic": r["topic"],
        "status": r["status"],
        "colour": r["colour"],
        "icon": r["icon"],
        "createdAt": r["created_at"],
        "moduleCount": r["module_count"],
        "chapterCount": r["chapter_count"],
        "projectCount": r["project_count"],
        "chaptersDone": r["chapters_done"],
        "jobId": r["job_id"] if r["status"] in ("planning", "building", "failed") else None,
        "lastOpenedChapterId": r["last_opened_chapter_id"],
        # The build stopped at the outline and waits for you to review it.
        "outlineReady": r["status"] == "planning" and bool(r["plan_pending"]),
    }


def list_courses(conn: sqlite3.Connection) -> list[dict]:
    return [course_summary(r) for r in rows(conn, _SUMMARY_SQL + " ORDER BY c.created_at DESC")]


def get_course_summary(conn: sqlite3.Connection, course_id: str) -> dict | None:
    r = row(conn, _SUMMARY_SQL + " WHERE c.id=?", (course_id,))
    return course_summary(r) if r else None


def weak_spots(conn: sqlite3.Connection, course_id: str) -> list[dict]:
    rs = rows(
        conn,
        """SELECT co.id AS concept_id, co.name, COUNT(*) AS wrong
           FROM attempts a
           JOIN questions q ON q.id=a.question_id
           JOIN chapters ch ON ch.id=q.chapter_id
           JOIN json_each(q.concept_ids) je
           JOIN concepts co ON co.id=je.value
           WHERE ch.course_id=? AND a.correct=0 AND a.at >= strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')
           GROUP BY co.id HAVING COUNT(*) >= 2 ORDER BY wrong DESC, co.name""",
        (course_id,),
    )
    return [{"conceptId": r["concept_id"], "name": r["name"], "wrong": r["wrong"]} for r in rs]


def course_detail(conn: sqlite3.Connection, course_id: str) -> dict | None:
    summary = get_course_summary(conn, course_id)
    if not summary:
        return None
    c = row(conn, "SELECT brief, summary FROM courses WHERE id=?", (course_id,))
    modules = []
    for m in rows(conn, "SELECT * FROM modules WHERE course_id=? ORDER BY position", (course_id,)):
        chapters = [
            {
                "id": ch["id"],
                "position": ch["position"],
                "title": ch["title"],
                "readingMinutes": ch["reading_minutes"],
                "done": ch["finished_at"] is not None,
            }
            for ch in rows(
                conn,
                """SELECT ch.*, pr.finished_at FROM chapters ch LEFT JOIN progress pr ON pr.chapter_id=ch.id
                   WHERE ch.module_id=? ORDER BY ch.position""",
                (m["id"],),
            )
        ]
        p = row(
            conn,
            """SELECT p.id, p.title,
                 (SELECT COUNT(*) FROM milestones ms WHERE ms.project_id=p.id AND ms.done_at IS NOT NULL) AS done,
                 (SELECT COUNT(*) FROM milestones ms WHERE ms.project_id=p.id) AS total
               FROM projects p WHERE p.module_id=? LIMIT 1""",
            (m["id"],),
        )
        modules.append(
            {
                "id": m["id"],
                "position": m["position"],
                "title": m["title"],
                "summary": m["summary"],
                "chapters": chapters,
                "project": (
                    {"id": p["id"], "title": p["title"], "milestonesDone": p["done"], "milestonesTotal": p["total"]}
                    if p
                    else None
                ),
            }
        )
    concepts = [
        {"id": r["id"], "name": r["name"], "summary": r["summary"]}
        for r in rows(conn, "SELECT * FROM concepts WHERE course_id=? ORDER BY rowid", (course_id,))
    ]
    edges = [
        {"from": r["from_id"], "to": r["to_id"]}
        for r in rows(
            conn,
            """SELECT e.from_id, e.to_id FROM concept_edges e JOIN concepts c ON c.id=e.from_id
               WHERE c.course_id=? AND e.kind='prereq'""",
            (course_id,),
        )
    ]
    brief = jload(c["brief"], {}) or {}
    brief.setdefault("topic", summary["topic"])
    brief.setdefault("answers", [])
    return {
        **summary,
        "brief": brief,
        "summary": c["summary"],
        "modules": modules,
        "concepts": concepts,
        "edges": edges,
        "weakSpots": weak_spots(conn, course_id),
    }


# ---- chapters -----------------------------------------------------------------------------------


def chapter_out(conn: sqlite3.Connection, chapter_id: str) -> dict | None:
    ch = row(
        conn,
        """SELECT ch.*, m.title AS module_title, m.position AS module_position, c.title AS course_title,
                  pr.started_at, pr.finished_at
           FROM chapters ch JOIN modules m ON m.id=ch.module_id JOIN courses c ON c.id=ch.course_id
           LEFT JOIN progress pr ON pr.chapter_id=ch.id WHERE ch.id=?""",
        (chapter_id,),
    )
    if not ch:
        return None
    order = rows(
        conn,
        """SELECT ch.id, ch.title FROM chapters ch JOIN modules m ON m.id=ch.module_id
           WHERE ch.course_id=? ORDER BY m.position, ch.position""",
        (ch["course_id"],),
    )
    idx = next(i for i, o in enumerate(order) if o["id"] == chapter_id)
    prev = {"id": order[idx - 1]["id"], "title": order[idx - 1]["title"]} if idx > 0 else None
    nxt = {"id": order[idx + 1]["id"], "title": order[idx + 1]["title"]} if idx + 1 < len(order) else None
    questions = []
    for q in rows(conn, "SELECT * FROM questions WHERE chapter_id=? ORDER BY position", (chapter_id,)):
        last = row(
            conn, "SELECT chosen, correct FROM attempts WHERE question_id=? ORDER BY at DESC, rowid DESC LIMIT 1", (q["id"],)
        )
        questions.append(
            {
                "id": q["id"],
                "prompt": q["prompt"],
                "options": jload(q["options"], []),
                "answer": q["answer"],
                "explanation": q["explanation"],
                "conceptIds": jload(q["concept_ids"], []),
                "lastAttempt": {"chosen": last["chosen"], "correct": bool(last["correct"])} if last else None,
            }
        )
    diagrams = [
        {"id": d["id"], "kind": d["kind"], "title": d["title"], "source": d["source"]}
        for d in rows(conn, "SELECT * FROM diagrams WHERE chapter_id=? ORDER BY position", (chapter_id,))
    ]
    return {
        "id": ch["id"],
        "courseId": ch["course_id"],
        "courseTitle": ch["course_title"],
        "moduleId": ch["module_id"],
        "moduleTitle": ch["module_title"],
        "position": ch["position"],
        "title": ch["title"],
        "markdown": ch["markdown"],
        "readingMinutes": ch["reading_minutes"],
        "questions": questions,
        "diagrams": diagrams,
        "prev": prev,
        "next": nxt,
        "startedAt": ch["started_at"],
        "finishedAt": ch["finished_at"],
    }


# ---- projects -----------------------------------------------------------------------------------


def milestone_out(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "position": r["position"],
        "title": r["title"],
        "body": r["body"],
        "checkCmd": r["check_cmd"],
        "doneAt": r["done_at"],
    }


def submission_out(conn: sqlite3.Connection, r: sqlite3.Row) -> dict:
    review = row(
        conn, "SELECT findings FROM reviews WHERE submission_id=? ORDER BY created_at DESC LIMIT 1", (r["id"],)
    )
    return {
        "id": r["id"],
        "projectId": r["project_id"],
        "milestoneId": r["milestone_id"],
        "repoUrl": r["repo_url"],
        "focus": r["focus"],
        "status": r["status"],
        "jobId": r["job_id"],
        "createdAt": r["created_at"],
        "findings": jload(review["findings"], []) if review else [],
        "error": r["error"],
    }


def project_out(conn: sqlite3.Connection, project_id: str) -> dict | None:
    p = row(
        conn,
        """SELECT p.*, m.title AS module_title, c.title AS course_title FROM projects p
           JOIN modules m ON m.id=p.module_id JOIN courses c ON c.id=p.course_id WHERE p.id=?""",
        (project_id,),
    )
    if not p:
        return None
    return {
        "id": p["id"],
        "courseId": p["course_id"],
        "courseTitle": p["course_title"],
        "moduleId": p["module_id"],
        "moduleTitle": p["module_title"],
        "title": p["title"],
        "brief": p["brief"],
        "starter": jload(p["starter"], []),
        "hints": jload(p["hints"], []),
        "rubric": jload(p["rubric"], []),
        "milestones": [
            milestone_out(m)
            for m in rows(conn, "SELECT * FROM milestones WHERE project_id=? ORDER BY position", (project_id,))
        ],
        "submissions": [
            submission_out(conn, s)
            for s in rows(conn, "SELECT * FROM submissions WHERE project_id=? ORDER BY created_at DESC", (project_id,))
        ],
    }


# ---- notes --------------------------------------------------------------------------------------


def note_summary(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "parentId": r["parent_id"],
        "position": r["position"],
        "title": r["title"],
        "icon": r["icon"],
        "courseId": r["course_id"],
        "chapterId": r["chapter_id"],
        "updatedAt": r["updated_at"],
    }


def note_page(conn: sqlite3.Connection, note_id: str) -> dict | None:
    r = row(conn, "SELECT * FROM note_pages WHERE id=? AND trashed_at IS NULL", (note_id,))
    if not r:
        return None
    backlinks = [
        {"id": b["id"], "title": b["title"], "icon": b["icon"]}
        for b in rows(
            conn,
            """SELECT DISTINCT n.id, n.title, n.icon FROM note_links l JOIN note_pages n ON n.id=l.from_page_id
               WHERE l.to_kind='note' AND l.to_id=? AND n.trashed_at IS NULL AND n.id != ? ORDER BY n.title""",
            (note_id, note_id),
        )
    ]
    props = jload(r["properties"], {}) or {}
    return {
        **note_summary(r),
        "cover": r["cover"],
        "properties": {str(k): str(v) for k, v in props.items()},
        "markdown": r["markdown"],
        "backlinks": backlinks,
    }


# ---- sources ------------------------------------------------------------------------------------


def source_out(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "kind": r["kind"],
        "title": r["title"],
        "uri": r["uri"],
        "courseId": r["course_id"],
        "status": r["status"],
        "chunkCount": r["chunk_count"],
        "error": r["error"],
        "updatedAt": r["updated_at"],
    }
