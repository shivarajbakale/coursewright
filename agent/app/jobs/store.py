"""jobs + job_events tables."""

from __future__ import annotations

import os
import socket
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from app.db import db, jdump, jload, new_id, now, row, tx

TERMINAL = ("done", "failed", "cancelled")
# This process's identity on job leases.
WORKER_ID = f"{socket.gethostname()}:{os.getpid()}:{uuid.uuid4().hex[:8]}"
HEARTBEAT_SECONDS = 10
STALE_SECONDS = 45  # a running job whose heartbeat is older than this belongs to a dead process
MAX_ATTEMPTS = 3


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


def claim_next(worker_id: str | None = None) -> sqlite3.Row | None:
    """Atomically move the oldest queued job to running, leased to this worker."""
    at = now()
    with db() as conn, tx(conn):
        return conn.execute(
            """UPDATE jobs SET status='running', started_at=COALESCE(started_at, ?), attempts=attempts+1,
                      worker_id=?, heartbeat_at=?
               WHERE id = (SELECT id FROM jobs WHERE status='queued' ORDER BY created_at LIMIT 1)
               RETURNING *""",
            (at, worker_id or WORKER_ID, at),
        ).fetchone()


def heartbeat(job_ids: list[str], worker_id: str | None = None) -> None:
    if not job_ids:
        return
    with db() as conn:
        conn.executemany(
            "UPDATE jobs SET heartbeat_at=? WHERE id=? AND status='running' AND worker_id=?",
            [(now(), jid, worker_id or WORKER_ID) for jid in job_ids],
        )


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def reclaim_stale(
    stale_seconds: float = STALE_SECONDS, worker_id: str | None = None, max_attempts: int = MAX_ATTEMPTS
) -> dict[str, list[dict]]:
    """Jobs left 'running' by a dead process (another worker id, or none, with a heartbeat older than
    `stale_seconds`) go back to the queue so they run again; build_course resumes its checkpointed thread.
    A job that has already used `max_attempts` claims fails instead (no crash loops), and one whose cancel
    was requested is cancelled. Returns {"requeued": [...], "failed": [...], "cancelled": [...]} job rows."""
    me = worker_id or WORKER_ID
    cutoff = _iso(datetime.now(timezone.utc) - timedelta(seconds=stale_seconds))
    out: dict[str, list[dict]] = {"requeued": [], "failed": [], "cancelled": []}
    with db() as conn, tx(conn):
        stale = conn.execute(
            """SELECT * FROM jobs WHERE status='running' AND (worker_id IS NULL OR worker_id != ?)
               AND (heartbeat_at IS NULL OR heartbeat_at < ?)""",
            (me, cutoff),
        ).fetchall()
        for r in stale:
            if r["cancel_requested"]:
                conn.execute(
                    "UPDATE jobs SET status='cancelled', error='Cancelled', finished_at=? WHERE id=?", (now(), r["id"])
                )
                out["cancelled"].append(dict(r))
            elif r["attempts"] >= max_attempts:
                msg = f"Gave up after {r['attempts']} attempts: the worker stopped while running this job"
                conn.execute("UPDATE jobs SET status='failed', error=?, finished_at=? WHERE id=?", (msg, now(), r["id"]))
                out["failed"].append({**dict(r), "error": msg})
            else:
                conn.execute("UPDATE jobs SET status='queued', worker_id=NULL, heartbeat_at=NULL WHERE id=?", (r["id"],))
                out["requeued"].append(dict(r))
    return out


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


def requeue_orphans() -> dict[str, list[dict]]:
    """At startup, a job still 'running' under another worker id with no heartbeat for STALE_SECONDS is an
    orphan of a dead process."""
    return reclaim_stale()
