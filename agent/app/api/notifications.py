from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.common import not_found, ok
from app.db import db, now, row, rows
from app.notify import LIMIT, notification_out

router = APIRouter()


@router.get("/notifications")
def list_notifications():
    with db() as conn:
        return ok(
            [
                notification_out(r)
                for r in rows(conn, "SELECT * FROM notifications ORDER BY created_at DESC, rowid DESC LIMIT ?", (LIMIT,))
            ]
        )


class ReadIn(BaseModel):
    read: bool = True


@router.patch("/notifications/{notification_id}")
def mark(notification_id: str, body: ReadIn):
    with db() as conn:
        if not row(conn, "SELECT id FROM notifications WHERE id=?", (notification_id,)):
            raise not_found("Notification not found")
        conn.execute(
            "UPDATE notifications SET read_at=? WHERE id=?", (now() if body.read else None, notification_id)
        )
        return ok(notification_out(row(conn, "SELECT * FROM notifications WHERE id=?", (notification_id,))))


@router.post("/notifications/mark-all-read")
def mark_all_read():
    with db() as conn:
        cur = conn.execute("UPDATE notifications SET read_at=? WHERE read_at IS NULL", (now(),))
        return ok({"updated": cur.rowcount})
