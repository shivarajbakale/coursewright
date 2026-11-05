from __future__ import annotations

import asyncio

from app.db import connect, migrate, rows


def test_migrations_and_extensions(client):
    conn = connect()
    try:
        assert migrate(conn) >= 1
        assert conn.execute("PRAGMA journal_mode").fetchone()[0] == "wal"
        assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        assert conn.execute("PRAGMA busy_timeout").fetchone()[0] == 30000
        assert conn.execute("SELECT vec_version()").fetchone()[0].startswith("v0.1")
        names = {r[0] for r in rows(conn, "SELECT name FROM sqlite_master")}
        assert {"chunks_fts", "chunk_vectors", "jobs", "job_events", "schema_version"} <= names
    finally:
        conn.close()


def test_seed_is_idempotent(client):
    from app.seed import seed_and_index

    def counts():
        conn = connect()
        try:
            return {
                t: conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
                for t in ("courses", "chapters", "questions", "attempts", "note_pages", "chunks", "sources", "projects")
            }
        finally:
            conn.close()

    # One run first: it also indexes notes that earlier tests wrote and nothing indexed yet. Idempotent
    # means that from there, running it again changes nothing.
    asyncio.run(seed_and_index())
    before = counts()
    assert before["courses"] >= 1 and before["chapters"] >= 10 and before["chunks"] > 0
    asyncio.run(seed_and_index())
    asyncio.run(seed_and_index())
    assert counts() == before


def test_seed_course_shape(course):
    assert len(course["modules"]) == 4
    assert sum(len(m["chapters"]) for m in course["modules"]) == 10
    assert all(m["project"] for m in course["modules"])
    assert course["weakSpots"], "seeded wrong attempts should produce weak spots"
    assert course["chaptersDone"] == 2
    assert course["edges"] and course["concepts"]
