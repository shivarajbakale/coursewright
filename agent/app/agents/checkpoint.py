"""The shared LangGraph checkpointer (AsyncSqliteSaver on the app's SQLite file).

Lifespan opens one and registers it with `set_saver`; the tutor and the course builder both use it (tutor:
one thread per conversation; builder: thread_id = job id). Code running outside the app's loop (tests,
`worker.drain()` scripts) gets its own short-lived saver from `saver()`.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator

from app import config

_saver = None


def set_saver(saver) -> None:
    global _saver
    _saver = saver


@asynccontextmanager
async def saver() -> AsyncIterator:
    from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

    if _saver is not None and getattr(_saver, "loop", None) is asyncio.get_running_loop():
        yield _saver
        return
    async with AsyncSqliteSaver.from_conn_string(str(config.db_path())) as s:
        await s.conn.execute("PRAGMA busy_timeout=5000")
        await s.setup()
        yield s


async def has_checkpoint(cp, thread_id: str) -> bool:
    return (await cp.aget_tuple({"configurable": {"thread_id": thread_id}})) is not None
