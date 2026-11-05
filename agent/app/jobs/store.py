"""jobs + job_events tables."""

from __future__ import annotations

import sqlite3
from typing import Any

from app.db import db, jdump, jload, new_id, now, row, tx

TERMINAL = ("done", "failed", "cancelled")


class Cancelled(Exception):
    pass


def create_job(conn: sqlite3.Connection, kind: str, input: dict | None = None, course_id: str | None = None) -> str:
    jid = new_id()
    conn.execute(
        "INSERT INTO jobs(id, kind, status, course_id, input, created_at) VALUES (?,?,?,?,?,?)",
        (jid, kind, "queued", course_id, jdump(input or {}), now()),
    )
    return jid


def enqueue(kind: str, input: dict | None = None, course_id: str | None = None) -> str:
    with db() as conn:
        return create_job(conn, kind, input, course_id)


def job_out(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "kind": r["kind"],
        "status": r["status"],
        "courseId": r["course_id"],
        "error": r["error"],
        "createdAt": r["created_at"],
        "usage": jload(r["usage"]),
    }


def get_job(conn: sqlite3.Connection, job_id: str) -> sqlite3.Row | None:
    return row(conn, "SELECT * FROM jobs WHERE id=?", (job_id,))


def emit(job_id: str, stage: str, message: str, payload: dict[str, Any] | None = None) -> dict:
    with db() as conn, tx(conn):
        seq = conn.execute("SELECT COALESCE(MAX(seq),0)+1 FROM job_events WHERE job_id=?", (job_id,)).fetchone()[0]
        at = now()
        cur = conn.execute(
            "INSERT INTO job_events(job_id, seq, stage, message, payload, at) VALUES (?,?,?,?,?,?)",
            (job_id, seq, stage, message, jdump(payload or {}), at),
        )
    return {"id": cur.lastrowid, "seq": seq, "stage": stage, "message": message, "payload": payload or {}, "at": at}


def event_out(r: sqlite3.Row) -> dict:
    return {
        "id": r["id"],
        "seq": r["seq"],
        "stage": r["stage"],
        "message": r["message"],
        "payload": jload(r["payload"], {}),
        "at": r["at"],
    }


def claim_next() -> sqlite3.Row | None:
    """Atomically move the oldest queued job to running."""
    with db() as conn, tx(conn):
        return conn.execute(
            """UPDATE jobs SET status='running', started_at=?, attempts=attempts+1
               WHERE id = (SELECT id FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1)
               RETURNING *""",
            (now(),),
        ).fetchone()


def finish(job_id: str, status: str, *, error: str | None = None, output: dict | None = None) -> None:
    with db() as conn:
        conn.execute(
            "UPDATE jobs SET status=?, error=?, output=COALESCE(?, output), finished_at=? WHERE id=?",
            (status, error, jdump(output) if output is not None else None, now(), job_id),
        )


def set_usage(job_id: str, input_tokens: int, output_tokens: int) -> None:
    with db() as conn:
        conn.execute(
            "UPDATE jobs SET usage=? WHERE id=?",
            (jdump({"inputTokens": input_tokens, "outputTokens": output_tokens}), job_id),
        )


def request_cancel(job_id: str) -> None:
    with db() as conn, tx(conn):
        conn.execute("UPDATE jobs SET cancel_requested=1 WHERE id=?", (job_id,))
        conn.execute(
            "UPDATE jobs SET status='cancelled', finished_at=? WHERE id=? AND status='queued'", (now(), job_id)
        )


def check_cancel(job_id: str) -> None:
    with db() as conn:
        r = row(conn, "SELECT cancel_requested FROM jobs WHERE id=?", (job_id,))
    if r is None or r[0]:
        raise Cancelled()


def requeue_orphans() -> None:
    """Jobs left 'running' by a crashed process go back to the queue."""
    with db() as conn:
        conn.execute("UPDATE jobs SET status='queued' WHERE status='running'")
