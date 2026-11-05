"""Hybrid retrieval: vector top-k (sqlite-vec) + FTS5 top-k, merged with reciprocal rank fusion,
filtered by scope, then reranked with Voyage when a key is available."""

from __future__ import annotations

import asyncio
import re

import sqlite_vec

from app.db import db, rows
from app.rag.embed import embed_query, rerank

RRF_K = 60
CANDIDATES = 50


def _fts_query(query: str) -> str | None:
    terms = [t for t in re.findall(r"[A-Za-z0-9]+", query) if len(t) > 1]
    if not terms:
        return None
    return " OR ".join(f'"{t}"' for t in terms)


def _candidates(vec: list[float], query: str, n: int) -> tuple[list[int], list[int]]:
    with db() as conn:
        vec_ids = [
            r[0]
            for r in conn.execute(
                "SELECT rowid FROM chunk_vectors WHERE embedding MATCH ? AND k = ? ORDER BY distance",
                (sqlite_vec.serialize_float32(vec), n),
            )
        ]
        fts_ids: list[int] = []
        fq = _fts_query(query)
        if fq:
            fts_ids = [
                r[0]
                for r in conn.execute(
                    "SELECT rowid FROM chunks_fts WHERE chunks_fts MATCH ? ORDER BY bm25(chunks_fts, 1.0, 0.5, 2.0) LIMIT ?",
                    (fq, n),
                )
            ]
    return vec_ids, fts_ids


async def hybrid_search(
    query: str,
    *,
    k: int = 6,
    course_id: str | None = None,
    chapter_id: str | None = None,
    kinds: list[str] | None = None,
) -> list[dict]:
    query = query.strip()
    if not query:
        return []
    vec = await embed_query(query)
    vec_ids, fts_ids = await asyncio.to_thread(_candidates, vec, query, CANDIDATES)

    scores: dict[int, float] = {}
    for ranked in (vec_ids, fts_ids):
        for rank, rid in enumerate(ranked):
            scores[rid] = scores.get(rid, 0.0) + 1.0 / (RRF_K + rank + 1)
    if not scores:
        return []

    def load() -> list[dict]:
        ids = list(scores)
        placeholders = ",".join("?" * len(ids))
        with db() as conn:
            found = rows(
                conn,
                f"""SELECT c.rowid AS rid, c.id, c.source_id, c.title, c.text, c.context, c.course_id, c.chapter_id,
                           c.anchor, s.kind
                    FROM chunks c JOIN sources s ON s.id=c.source_id WHERE c.rowid IN ({placeholders})""",
                ids,
            )
        out = []
        for r in found:
            if course_id and r["course_id"] != course_id:
                continue
            if chapter_id and r["chapter_id"] != chapter_id:
                continue
            if kinds and r["kind"] not in kinds:
                continue
            out.append(
                {
                    "chunkId": r["id"],
                    "sourceId": r["source_id"],
                    "title": r["title"],
                    "text": r["text"],
                    "context": r["context"],
                    "score": round(scores[r["rid"]], 6),
                    "courseId": r["course_id"],
                    "chapterId": r["chapter_id"],
                    "anchor": r["anchor"],
                    "kind": r["kind"],
                }
            )
        out.sort(key=lambda h: h["score"], reverse=True)
        return out

    hits = await asyncio.to_thread(load)
    hits = hits[:20]
    try:
        reranked = await rerank(query, [f"{h['context']}\n\n{h['text']}" for h in hits], top_k=k)
    except Exception:
        reranked = None
    if reranked is not None:
        hits = [{**hits[i], "score": round(s, 6)} for i, s in reranked]
    hits = hits[:k]
    for h in hits:
        h.pop("kind", None)
    return hits
