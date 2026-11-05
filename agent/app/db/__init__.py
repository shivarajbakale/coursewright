"""SQLite access: one file, WAL, busy_timeout 5s, foreign keys, sqlite-vec loaded.

Plain `sqlite3` connections, one per unit of work. REST handlers are sync (FastAPI runs them in its
threadpool); async code calls the same helpers through `asyncio.to_thread`.
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

import sqlite_vec

from app import config

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def new_id() -> str:
    return str(uuid.uuid4())


def connect(path: Path | None = None) -> sqlite3.Connection:
    path = path or config.db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=5.0, isolation_level=None, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.enable_load_extension(True)
    sqlite_vec.load(conn)
    conn.enable_load_extension(False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    """A connection in autocommit mode. Use `tx(conn)` for multi-statement writes."""
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def tx(conn: sqlite3.Connection, immediate: bool = True) -> Iterator[sqlite3.Connection]:
    conn.execute("BEGIN IMMEDIATE" if immediate else "BEGIN")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    else:
        conn.execute("COMMIT")


def migrate(conn: sqlite3.Connection) -> int:
    """Apply migrations/*.sql in order, recording each in schema_version. Returns the version."""
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)"
    )
    applied = {r[0] for r in conn.execute("SELECT version FROM schema_version")}
    for f in sorted(MIGRATIONS_DIR.glob("*.sql")):
        version = int(f.name.split("_", 1)[0])
        if version in applied:
            continue
        with tx(conn):
            # executescript would COMMIT our transaction, so run statements one by one.
            for stmt in _split_sql(f.read_text()):
                conn.execute(stmt)
            conn.execute(
                "INSERT INTO schema_version(version, name, applied_at) VALUES (?,?,?)", (version, f.name, now())
            )
    return conn.execute("SELECT COALESCE(MAX(version),0) FROM schema_version").fetchone()[0]


def _split_sql(sql: str) -> list[str]:
    lines = [ln for ln in sql.splitlines() if not ln.strip().startswith("--")]
    out, buf = [], []
    for ln in lines:
        buf.append(ln)
        if sqlite3.complete_statement("\n".join(buf)):
            stmt = "\n".join(buf).strip()
            if stmt.rstrip(";").strip():
                out.append(stmt)
            buf = []
    return out


def init_db() -> None:
    with db() as conn:
        migrate(conn)


# ---- small helpers -------------------------------------------------------------------------------


def row(conn: sqlite3.Connection, sql: str, params: tuple | list = ()) -> sqlite3.Row | None:
    return conn.execute(sql, params).fetchone()


def rows(conn: sqlite3.Connection, sql: str, params: tuple | list = ()) -> list[sqlite3.Row]:
    return conn.execute(sql, params).fetchall()


def jload(value: str | None, default: Any = None) -> Any:
    if value is None or value == "":
        return default
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return default


def jdump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def get_meta(conn: sqlite3.Connection, key: str) -> str | None:
    r = row(conn, "SELECT value FROM meta WHERE key=?", (key,))
    return r[0] if r else None


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, value)
    )
