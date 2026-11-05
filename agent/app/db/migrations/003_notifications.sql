-- Notices for work that ran while you were away: a course build or a project review that finished or
-- failed, and a link you added that could not be indexed. Written by the job worker (app/notify.py).
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('course_ready','course_failed','review_ready','review_failed','source_failed')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  job_id TEXT UNIQUE,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX notifications_created ON notifications(created_at);
