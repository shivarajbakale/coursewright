"""Ingest: parse -> chunk -> contextualise -> embed -> store (chunks + chunk_vectors + chunks_fts)."""

from __future__ import annotations

import asyncio
import hashlib
import html
import logging
import os
import re
import sqlite3

import sqlite_vec

from app import config
from app.db import db, new_id, now, row, rows, tx
from app.rag.chunk import chunk_markdown
from app.rag.embed import embed_documents

log = logging.getLogger(__name__)


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


# ---- sources ------------------------------------------------------------------------------------


def upsert_source(
    conn: sqlite3.Connection,
    *,
    kind: str,
    ref_id: str | None,
    title: str,
    uri: str | None = None,
    course_id: str | None = None,
    chapter_id: str | None = None,
) -> str:
    existing = row(conn, "SELECT id FROM sources WHERE kind=? AND ref_id=?", (kind, ref_id)) if ref_id else None
    if existing:
        conn.execute(
            "UPDATE sources SET title=?, uri=?, course_id=?, chapter_id=?, updated_at=? WHERE id=?",
            (title, uri, course_id, chapter_id, now(), existing["id"]),
        )
        return existing["id"]
    sid = new_id()
    conn.execute(
        "INSERT INTO sources(id, kind, title, uri, ref_id, course_id, chapter_id, status, updated_at) VALUES (?,?,?,?,?,?,?,'pending',?)",
        (sid, kind, title, uri, ref_id, course_id, chapter_id, now()),
    )
    return sid


def delete_source(conn: sqlite3.Connection, source_id: str) -> None:
    _delete_chunks(conn, source_id)
    conn.execute("DELETE FROM sources WHERE id=?", (source_id,))


def _delete_chunks(conn: sqlite3.Connection, source_id: str) -> None:
    rowids = [r[0] for r in conn.execute("SELECT rowid FROM chunks WHERE source_id=?", (source_id,))]
    for rid in rowids:
        conn.execute("DELETE FROM chunk_vectors WHERE rowid=?", (rid,))
        conn.execute("DELETE FROM chunks_fts WHERE rowid=?", (rid,))
    conn.execute("DELETE FROM chunks WHERE source_id=?", (source_id,))


# ---- loading text -------------------------------------------------------------------------------


async def _load(source: sqlite3.Row) -> tuple[str, str, dict]:
    """Returns (markdown, title, meta) for a source."""
    kind = source["kind"]
    with db() as conn:
        if kind == "chapter":
            r = row(
                conn,
                """SELECT ch.title, ch.markdown, m.title AS module_title, m.position AS mpos, ch.position AS cpos,
                          c.title AS course_title
                   FROM chapters ch JOIN modules m ON m.id=ch.module_id JOIN courses c ON c.id=ch.course_id
                   WHERE ch.id=?""",
                (source["ref_id"],),
            )
            if not r:
                raise LookupError("chapter no longer exists")
            return r["markdown"], r["title"], dict(r)
        if kind == "note":
            r = row(conn, "SELECT title, markdown FROM note_pages WHERE id=?", (source["ref_id"],))
            if not r:
                raise LookupError("note no longer exists")
            return f"# {r['title']}\n\n{r['markdown']}", r["title"], {}
        if kind == "tutor":
            return source["title"], source["title"], {}
    # url
    import httpx

    async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
        resp = await client.get(source["uri"], headers={"User-Agent": "Coursewright/0.1"})
        resp.raise_for_status()
        body = resp.text
    if "html" in resp.headers.get("content-type", ""):
        m = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
        title = html.unescape(m.group(1).strip()) if m else source["uri"]
        return _html_to_text(body), title, {}
    return body, source["title"] or source["uri"], {}


def _html_to_text(body: str) -> str:
    body = re.sub(r"(?is)<(script|style|nav|footer|header|noscript)[^>]*>.*?</\1>", " ", body)
    body = re.sub(r"(?i)<h([1-4])[^>]*>", lambda m: "\n\n" + "#" * int(m.group(1)) + " ", body)
    body = re.sub(r"(?i)</(p|div|li|h[1-6]|pre|tr)>", "\n\n", body)
    body = re.sub(r"(?i)<br\s*/?>", "\n", body)
    body = re.sub(r"<[^>]+>", " ", body)
    body = html.unescape(body)
    body = re.sub(r"[ \t]+", " ", body)
    return re.sub(r"\n\s*\n+", "\n\n", body).strip()


async def _contextualise(kind: str, title: str, meta: dict, heading: str, text: str, doc: str, llm: bool) -> str:
    if kind == "chapter":
        where = (
            f"From chapter {meta.get('mpos')}.{meta.get('cpos')} {title}"
            + (f", section {heading}" if heading and heading != title else "")
            + f", in module {meta.get('module_title')} of the course {meta.get('course_title')}."
        )
    elif kind == "note":
        where = f"From your note '{title}'" + (f", section {heading}." if heading and heading != title else ".")
    else:
        where = f"From '{title}'" + (f", section {heading}." if heading else ".")
    # A lesson's place (module, lesson, section) is the context; a model call per chunk is for sources whose
    # structure we don't know (a PDF, a web page, a note).
    if kind != "chapter" and llm and config.anthropic_key() and os.environ.get("CW_CONTEXTUALISE", "1") == "1":
        try:
            from app.agents.llm import text as llm_text

            extra = await llm_text(
                system="You situate a chunk inside its document for search retrieval. Reply with one or two "
                "sentences, no preamble.",
                user=f"<document>\n{doc[:30000]}\n</document>\n<chunk>\n{text}\n</chunk>\n"
                "Give a short context that situates this chunk within the document.",
                effort="low",
                max_tokens=300,
            )
            return f"{where} {extra}".strip()
        except Exception as e:  # contextualisation is best-effort
            log.warning("contextualise failed: %s", e)
    return where


# ---- ingest -------------------------------------------------------------------------------------


async def ingest_source(source_id: str, force: bool = False, llm_context: bool = True) -> int:
    """(Re)index one source. Returns its chunk count."""
    with db() as conn:
        source = row(conn, "SELECT * FROM sources WHERE id=?", (source_id,))
    if not source:
        raise LookupError(f"source {source_id} not found")
    try:
        markdown, title, meta = await _load(source)
        content_hash = sha(markdown)
        model = config.embed_model()
        with db() as conn:
            same_model = row(
                conn, "SELECT COUNT(*) FROM chunks WHERE source_id=? AND embed_model!=?", (source_id, model)
            )[0] == 0
        if not force and source["status"] == "indexed" and source["content_hash"] == content_hash and same_model:
            return source["chunk_count"]

        pieces = chunk_markdown(markdown)
        contexts = await asyncio.gather(
            *[_contextualise(source["kind"], title, meta, p.heading, p.text, markdown, llm_context) for p in pieces]
        )
        vectors = await embed_documents([f"{c}\n\n{p.text}" for c, p in zip(contexts, pieces)])

        def write() -> int:
            with db() as conn, tx(conn):
                _delete_chunks(conn, source_id)
                for p, ctx, vec in zip(pieces, contexts, vectors):
                    cur = conn.execute(
                        """INSERT INTO chunks(id, source_id, course_id, chapter_id, anchor, position, title, text, context,
                                              content_hash, embed_model) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                        (
                            new_id(), source_id, source["course_id"], source["chapter_id"], p.anchor, p.position,
                            title, p.text, ctx, sha(p.text), model,
                        ),
                    )
                    rid = cur.lastrowid
                    conn.execute(
                        "INSERT INTO chunk_vectors(rowid, embedding) VALUES (?, ?)",
                        (rid, sqlite_vec.serialize_float32(vec)),
                    )
                    conn.execute(
                        "INSERT INTO chunks_fts(rowid, text, context, title) VALUES (?,?,?,?)", (rid, p.text, ctx, title)
                    )
                conn.execute(
                    "UPDATE sources SET status='indexed', error=NULL, chunk_count=?, content_hash=?, title=?, updated_at=? WHERE id=?",
                    (len(pieces), content_hash, title, now(), source_id),
                )
            return len(pieces)

        return await asyncio.to_thread(write)
    except Exception as e:
        with db() as conn:
            conn.execute(
                "UPDATE sources SET status='failed', error=?, updated_at=? WHERE id=?", (str(e)[:500], now(), source_id)
            )
        raise


def ensure_course_sources(course_id: str) -> list[str]:
    with db() as conn, tx(conn):
        out = []
        for ch in rows(conn, "SELECT id, title, course_id FROM chapters WHERE course_id=?", (course_id,)):
            out.append(
                upsert_source(
                    conn,
                    kind="chapter",
                    ref_id=ch["id"],
                    title=ch["title"],
                    uri=f"/courses/{course_id}/chapters/{ch['id']}",
                    course_id=course_id,
                    chapter_id=ch["id"],
                )
            )
        return out


def ensure_note_source(note_id: str) -> str:
    with db() as conn, tx(conn):
        n = row(conn, "SELECT id, title, course_id, chapter_id FROM note_pages WHERE id=?", (note_id,))
        if not n:
            raise LookupError("note not found")
        return upsert_source(
            conn,
            kind="note",
            ref_id=note_id,
            title=n["title"],
            uri=f"/notes/{note_id}",
            course_id=n["course_id"],
            chapter_id=n["chapter_id"],
        )


async def ingest_course(course_id: str, force: bool = False, llm_context: bool = True) -> int:
    total = 0
    for sid in await asyncio.to_thread(ensure_course_sources, course_id):
        total += await ingest_source(sid, force=force, llm_context=llm_context)
    return total
