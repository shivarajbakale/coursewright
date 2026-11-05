"""First-start seed: the Raft course (from app/seed/raft/, the same folder format the builder writes),
a few nested notes, progress and quiz attempts (so weak spots show), then index it all. Idempotent."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.db import db, get_meta, jdump, new_id, now, row, rows, set_meta, tx
from app.materialise import materialise

log = logging.getLogger(__name__)

SEED_DIR = Path(__file__).parent / "raft"
SEED_KEY = "raft"


def _ago(**kw) -> str:
    return (datetime.now(timezone.utc) - timedelta(**kw)).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def seed_db() -> str | None:
    """Writes seed rows if missing. Returns the seeded course id (or None if the folder is absent)."""
    with db() as conn:
        existing = row(conn, "SELECT id FROM courses WHERE seed_key=?", (SEED_KEY,))
        if existing:
            course_id = existing["id"]
        elif get_meta(conn, "seed.course") == "deleted":
            return None  # the user deleted the seed course; don't bring it back
        elif not (SEED_DIR / "outline.json").exists():
            log.warning("seed folder %s missing; skipping course seed", SEED_DIR)
            return None
        else:
            course_id = materialise(
                conn,
                SEED_DIR,
                seed_key=SEED_KEY,
                brief={
                    "topic": "Raft consensus",
                    "answers": [
                        {"question": "How comfortable are you with distributed systems?", "answer": ["Some basics"]},
                        {"question": "What do you want to be able to do?", "answer": ["Implement Raft myself"]},
                        {"question": "How much time per week?", "answer": ["3-5 hours"]},
                    ],
                    "level": "intermediate",
                    "goal": "Understand Raft well enough to implement it",
                    "pace": "3-5 hours a week",
                },
            )
            set_meta(conn, "seed.course", "done")
        if get_meta(conn, "seed.extras") != "done":
            with tx(conn):
                _seed_extras(conn, course_id)
                set_meta(conn, "seed.extras", "done")
    return course_id


def _seed_extras(conn, course_id: str) -> None:
    chapters = rows(
        conn,
        """SELECT ch.id, ch.title FROM chapters ch JOIN modules m ON m.id=ch.module_id
           WHERE ch.course_id=? ORDER BY m.position, ch.position""",
        (course_id,),
    )
    # Progress: first two chapters finished, third started.
    for i, ch in enumerate(chapters[:3]):
        conn.execute(
            "INSERT OR REPLACE INTO progress(chapter_id, started_at, finished_at) VALUES (?,?,?)",
            (ch["id"], _ago(days=6 - i), _ago(days=5 - i) if i < 2 else None),
        )
    if len(chapters) >= 3:
        conn.execute("UPDATE courses SET last_opened_chapter_id=? WHERE id=?", (chapters[2]["id"], course_id))

    # Attempts: right answers early on; repeated misses on election restriction and commitment.
    def questions_of(idx: int):
        if idx >= len(chapters):
            return []
        return rows(conn, "SELECT id, answer, options FROM questions WHERE chapter_id=? ORDER BY position", (chapters[idx]["id"],))

    for q in questions_of(0) + questions_of(1):
        conn.execute(
            "INSERT INTO attempts(id, question_id, chosen, correct, at) VALUES (?,?,?,?,?)",
            (new_id(), q["id"], q["answer"], 1, _ago(days=4)),
        )
    for idx in (5, 7):  # election restriction, commitment
        for q in questions_of(idx)[:2]:
            wrong = (q["answer"] + 1) % max(2, len(__import__("json").loads(q["options"])))
            for d in (3, 2):
                conn.execute(
                    "INSERT INTO attempts(id, question_id, chosen, correct, at) VALUES (?,?,?,?,?)",
                    (new_id(), q["id"], wrong, 0, _ago(days=d)),
                )

    # Notes: a small nested tree, one page linked to the election chapter.
    election = chapters[3] if len(chapters) > 3 else (chapters[0] if chapters else None)
    root, cheat, qs, reading = new_id(), new_id(), new_id(), new_id()
    t = now()
    notes = [
        (
            root, None, 0, "Raft study notes", "🗳️", course_id, None,
            "Working notes while going through the Raft course.\n\n"
            f"- [Leader election cheatsheet](/notes/{cheat}) — timeouts, votes, terms\n"
            f"- [Reading list](/notes/{reading})\n\n"
            "## Things that clicked\n\n"
            "- A **term** is a logical clock. Any message with a higher term makes you step down.\n"
            "- Majorities overlap, so two leaders can never both win the same term.\n",
            {"status": "In progress", "tags": "raft, consensus"},
        ),
        (
            cheat, root, 0, "Leader election cheatsheet", "⏱️", course_id, election["id"] if election else None,
            "> **Key idea:** a server votes at most once per term, and only for a candidate whose log is at least "
            "as up to date as its own.\n\n"
            "## Timeline\n\n"
            "1. Follower hears nothing for an election timeout (150–300 ms, randomised).\n"
            "2. It increments `currentTerm`, votes for itself, becomes **candidate**.\n"
            "3. Sends `RequestVote(term, candidateId, lastLogIndex, lastLogTerm)` to everyone.\n"
            "4. Majority of votes → **leader**; sends empty `AppendEntries` heartbeats at once.\n\n"
            "## Gotchas\n\n"
            "- Persist `currentTerm` and `votedFor` *before* replying to a vote request.\n"
            "- Reset the election timer only when you **grant** a vote, not on every request.\n"
            "- \"Up to date\" compares last log **term** first, then last index.\n",
            {"status": "Done"},
        ),
        (
            qs, cheat, 0, "Questions for the tutor", "❓", course_id, None,
            "- Why can't a leader commit an entry from a previous term just by counting replicas?\n"
            "- What happens to a stale leader that is partitioned away with a minority?\n"
            "- How does ReadIndex avoid writing a log entry for reads?\n",
            {},
        ),
        (
            reading, root, 1, "Reading list", "📚", None, None,
            "- Ongaro & Ousterhout, *In Search of an Understandable Consensus Algorithm* (2014)\n"
            "- Ongaro, *Consensus: Bridging Theory and Practice* (PhD thesis, 2014), chapters 3, 4 and 6\n"
            "- The Raft visualisation at raft.github.io\n"
            "- MIT 6.5840 lab notes on Raft\n",
            {"status": "Backlog"},
        ),
    ]
    for nid, parent, pos, title, icon, cid, chid, md, props in notes:
        conn.execute(
            """INSERT INTO note_pages(id, parent_id, position, title, icon, cover, properties, markdown, course_id, chapter_id,
                                      created_at, updated_at) VALUES (?,?,?,?,?,NULL,?,?,?,?,?,?)""",
            (nid, parent, pos, title, icon, jdump(props), md, cid, chid, t, t),
        )
    from app.api.notes import sync_links

    for nid, *_rest in notes:
        sync_links(conn, nid, _rest[6])


async def seed_and_index() -> str | None:
    import asyncio

    from app.rag import ingest

    course_id = await asyncio.to_thread(seed_db)
    if course_id:
        await ingest.ingest_course(course_id, llm_context=False)

    def note_ids() -> list[str]:
        with db() as conn:
            return [r["id"] for r in rows(conn, "SELECT id FROM note_pages WHERE trashed_at IS NULL")]

    for nid in await asyncio.to_thread(note_ids):
        sid = await asyncio.to_thread(ingest.ensure_note_source, nid)
        await ingest.ingest_source(sid, llm_context=False)
    return course_id
