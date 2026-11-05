from __future__ import annotations

import re
import sqlite3

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.api.common import not_found, note_page, note_summary, ok
from app.db import db, jdump, new_id, now, row, rows, tx
from app.jobs import store
from app.rag.ingest import delete_source

router = APIRouter()

_NOTE_LINK = re.compile(r"/notes/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")
_CHAPTER_LINK = re.compile(r"/chapters/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})")


def sync_links(conn: sqlite3.Connection, note_id: str, markdown: str) -> None:
    """Rebuild note_links (mentions and backlinks) from the links in a page's markdown."""
    conn.execute("DELETE FROM note_links WHERE from_page_id=?", (note_id,))
    for kind, pattern in (("note", _NOTE_LINK), ("chapter", _CHAPTER_LINK)):
        for target in set(pattern.findall(markdown or "")):
            conn.execute(
                "INSERT OR IGNORE INTO note_links(from_page_id, to_kind, to_id) VALUES (?,?,?)", (note_id, kind, target)
            )


def _enqueue_index(note_id: str) -> None:
    store.enqueue("ingest", {"noteId": note_id})


@router.get("/notes/tree")
def tree():
    with db() as conn:
        return ok(
            [
                note_summary(r)
                for r in rows(
                    conn, "SELECT * FROM note_pages WHERE trashed_at IS NULL ORDER BY parent_id IS NOT NULL, parent_id, position, created_at"
                )
            ]
        )


@router.get("/notes/recent")
def recent():
    with db() as conn:
        return ok(
            [
                note_summary(r)
                for r in rows(conn, "SELECT * FROM note_pages WHERE trashed_at IS NULL ORDER BY updated_at DESC LIMIT 8")
            ]
        )


def _snippet(text: str, q: str, width: int = 140) -> str:
    flat = re.sub(r"\s+", " ", text).strip()
    i = flat.lower().find(q.lower())
    if i < 0:
        return flat[:width]
    start = max(0, i - width // 3)
    s = flat[start : start + width]
    return ("…" if start > 0 else "") + s + ("…" if start + width < len(flat) else "")


@router.get("/notes/search")
def search(q: str = Query("")):
    q = q.strip()
    if not q:
        return ok([])
    like = f"%{q}%"
    with db() as conn:
        rs = rows(
            conn,
            """SELECT id, title, icon, markdown, (title LIKE ?) AS in_title FROM note_pages
               WHERE trashed_at IS NULL AND (title LIKE ? OR markdown LIKE ?)
               ORDER BY in_title DESC, updated_at DESC LIMIT 20""",
            (like, like, like),
        )
    return ok([{"id": r["id"], "title": r["title"], "icon": r["icon"], "snippet": _snippet(r["markdown"], q)} for r in rs])


class NoteCreate(BaseModel):
    parentId: str | None = None
    title: str | None = None
    icon: str | None = None
    markdown: str | None = None
    courseId: str | None = None
    chapterId: str | None = None


@router.post("/notes", status_code=201)
def create(body: NoteCreate):
    nid = new_id()
    t = now()
    with db() as conn, tx(conn):
        if body.parentId and not row(conn, "SELECT 1 FROM note_pages WHERE id=?", (body.parentId,)):
            raise HTTPException(status_code=422, detail="parentId does not exist")
        course_id = body.courseId
        if body.chapterId:
            ch = row(conn, "SELECT course_id FROM chapters WHERE id=?", (body.chapterId,))
            if not ch:
                raise HTTPException(status_code=422, detail="chapterId does not exist")
            course_id = course_id or ch["course_id"]
        if course_id and not row(conn, "SELECT 1 FROM courses WHERE id=?", (course_id,)):
            raise HTTPException(status_code=422, detail="courseId does not exist")
        pos = conn.execute(
            "SELECT COALESCE(MAX(position)+1, 0) FROM note_pages WHERE parent_id IS ?", (body.parentId,)
        ).fetchone()[0]
        conn.execute(
            """INSERT INTO note_pages(id, parent_id, position, title, icon, properties, markdown, course_id, chapter_id,
                                      created_at, updated_at) VALUES (?,?,?,?,?, '{}', ?,?,?,?,?)""",
            (
                nid, body.parentId, pos, (body.title or "Untitled").strip() or "Untitled", body.icon or "",
                body.markdown or "", course_id, body.chapterId, t, t,
            ),
        )
        sync_links(conn, nid, body.markdown or "")
    if body.markdown:
        _enqueue_index(nid)
    with db() as conn:
        return ok(note_page(conn, nid))


@router.get("/notes/{note_id}")
def get_note(note_id: str):
    with db() as conn:
        page = note_page(conn, note_id)
    if not page:
        raise not_found("Note not found")
    return ok(page)


class NotePatch(BaseModel):
    title: str | None = None
    icon: str | None = None
    cover: str | None = None
    markdown: str | None = None
    parentId: str | None = None
    position: int | None = None
    properties: dict[str, str] | None = None


@router.patch("/notes/{note_id}")
def patch_note(note_id: str, body: NotePatch):
    fields = body.model_fields_set
    reindex = False
    with db() as conn, tx(conn):
        if not row(conn, "SELECT 1 FROM note_pages WHERE id=? AND trashed_at IS NULL", (note_id,)):
            raise not_found("Note not found")
        sets: dict[str, object] = {}
        if "title" in fields:
            sets["title"] = (body.title or "").strip() or "Untitled"
            reindex = True
        if "icon" in fields:
            sets["icon"] = body.icon or ""
        if "cover" in fields:
            sets["cover"] = body.cover
        if "markdown" in fields:
            sets["markdown"] = body.markdown or ""
            sync_links(conn, note_id, body.markdown or "")
            reindex = True
        if "properties" in fields:
            sets["properties"] = jdump(body.properties or {})
        if "parentId" in fields:
            parent = body.parentId
            if parent:
                # Refuse to move a page under itself or one of its descendants.
                cur: str | None = parent
                while cur:
                    if cur == note_id:
                        raise HTTPException(status_code=422, detail="cannot move a page inside itself")
                    r = row(conn, "SELECT parent_id FROM note_pages WHERE id=?", (cur,))
                    if r is None:
                        raise HTTPException(status_code=422, detail="parentId does not exist")
                    cur = r["parent_id"]
            sets["parent_id"] = parent
        if "position" in fields and body.position is not None:
            sets["position"] = body.position
        sets["updated_at"] = now()
        conn.execute(
            f"UPDATE note_pages SET {', '.join(f'{k}=?' for k in sets)} WHERE id=?", (*sets.values(), note_id)
        )
    if reindex:
        _enqueue_index(note_id)
    with db() as conn:
        return ok(note_page(conn, note_id))


@router.delete("/notes/{note_id}")
def delete_note(note_id: str):
    with db() as conn, tx(conn):
        if not row(conn, "SELECT 1 FROM note_pages WHERE id=?", (note_id,)):
            raise not_found("Note not found")
        ids = [
            r[0]
            for r in conn.execute(
                """WITH RECURSIVE sub(id) AS (SELECT ? UNION ALL SELECT n.id FROM note_pages n JOIN sub ON n.parent_id=sub.id)
                   SELECT id FROM sub""",
                (note_id,),
            )
        ]
        for nid in ids:
            s = row(conn, "SELECT id FROM sources WHERE kind='note' AND ref_id=?", (nid,))
            if s:
                delete_source(conn, s["id"])
        conn.execute("DELETE FROM note_pages WHERE id=?", (note_id,))  # children cascade
    return ok({"ok": True})


# ---- A chapter's own notes page ------------------------------------------------------------------------
# One live page per chapter, marked {"chapterNote": true} so older one-off "Add to notes" pages (which also
# carry chapter_id) are not mistaken for it. It nests under one page per course, marked {"courseNotes": true}.


def _chapter_note(conn: sqlite3.Connection, chapter_id: str) -> sqlite3.Row | None:
    return row(
        conn,
        "SELECT * FROM note_pages WHERE chapter_id=? AND trashed_at IS NULL"
        " AND json_extract(properties, '$.chapterNote') = 1 ORDER BY created_at LIMIT 1",
        (chapter_id,),
    )


def _course_parent(conn: sqlite3.Connection, course_id: str, title: str) -> str:
    r = row(
        conn,
        "SELECT id FROM note_pages WHERE course_id=? AND trashed_at IS NULL"
        " AND json_extract(properties, '$.courseNotes') = 1 ORDER BY created_at LIMIT 1",
        (course_id,),
    )
    if r:
        return r["id"]
    pid, t = new_id(), now()
    pos = conn.execute("SELECT COALESCE(MAX(position)+1, 0) FROM note_pages WHERE parent_id IS NULL").fetchone()[0]
    conn.execute(
        """INSERT INTO note_pages(id, parent_id, position, title, icon, properties, markdown, course_id,
                                  created_at, updated_at) VALUES (?,NULL,?,?, '', ?, '', ?,?,?)""",
        (pid, pos, title, jdump({"courseNotes": True}), course_id, t, t),
    )
    return pid


@router.get("/chapters/{chapter_id}/note")
def get_chapter_note(chapter_id: str):
    with db() as conn:
        if not row(conn, "SELECT 1 FROM chapters WHERE id=?", (chapter_id,)):
            raise not_found("Chapter not found")
        r = _chapter_note(conn, chapter_id)
        return ok(note_page(conn, r["id"]) if r else None)


class ChapterNoteIn(BaseModel):
    # Markdown added at the end of the page, e.g. a quoted passage.
    append: str | None = None


@router.post("/chapters/{chapter_id}/note")
def ensure_chapter_note(chapter_id: str, body: ChapterNoteIn):
    """Get or create the chapter's notes page, optionally appending markdown to it."""
    with db() as conn, tx(conn):
        ch = row(
            conn,
            "SELECT c.id, c.title, c.course_id, co.title AS course_title FROM chapters c"
            " JOIN courses co ON co.id = c.course_id WHERE c.id=?",
            (chapter_id,),
        )
        if not ch:
            raise not_found("Chapter not found")
        page = _chapter_note(conn, chapter_id)
        t = now()
        if not page:
            parent = _course_parent(conn, ch["course_id"], ch["course_title"])
            nid = new_id()
            pos = conn.execute("SELECT COALESCE(MAX(position)+1, 0) FROM note_pages WHERE parent_id=?", (parent,)).fetchone()[0]
            conn.execute(
                """INSERT INTO note_pages(id, parent_id, position, title, icon, properties, markdown, course_id,
                                          chapter_id, created_at, updated_at) VALUES (?,?,?,?, '', ?, '', ?,?,?,?)""",
                (nid, parent, pos, f"Notes: {ch['title']}", jdump({"chapterNote": True}), ch["course_id"], chapter_id, t, t),
            )
            page = row(conn, "SELECT * FROM note_pages WHERE id=?", (nid,))
        changed = bool(body.append and body.append.strip())
        if changed:
            current = (page["markdown"] or "").rstrip()
            markdown = (current + "\n\n" if current else "") + body.append.strip() + "\n"
            conn.execute("UPDATE note_pages SET markdown=?, updated_at=? WHERE id=?", (markdown, t, page["id"]))
            sync_links(conn, page["id"], markdown)
        nid = page["id"]
    if changed:
        _enqueue_index(nid)
    with db() as conn:
        return ok(note_page(conn, nid))
