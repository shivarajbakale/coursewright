-- The outline a build pauses on, so the learner can reshape it before any chapter is written.
-- One row per course. `workdir` is the job folder (data/jobs/<id>) holding the research notes and the course
-- files; the writing job reuses it. `approved_at` is set when writing starts.
CREATE TABLE course_plans (
  course_id TEXT PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  outline TEXT NOT NULL,
  messages TEXT NOT NULL DEFAULT '[]',
  workdir TEXT NOT NULL,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- A new notice kind, outline_ready. SQLite can't alter a CHECK, so the table is rebuilt.
CREATE TABLE notifications_new (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('course_ready','course_failed','outline_ready','review_ready','review_failed','source_failed')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  job_id TEXT UNIQUE,
  read_at TEXT,
  created_at TEXT NOT NULL
);
INSERT INTO notifications_new SELECT id, kind, title, body, href, course_id, job_id, read_at, created_at FROM notifications;
DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;
CREATE INDEX notifications_created ON notifications(created_at);
