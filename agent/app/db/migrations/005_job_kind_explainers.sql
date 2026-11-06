-- A new job kind, 'explainers' (app/jobs/explainers.py: Inkling explainers for an existing course).
-- SQLite can't change a CHECK in place, so jobs is rebuilt. job_events references jobs with ON DELETE CASCADE
-- and foreign keys are on, so it moves aside first: renaming jobs then repoints the old events table at the
-- old jobs table, and dropping the old tables last deletes nothing that is still wanted.
ALTER TABLE job_events RENAME TO job_events_old;
ALTER TABLE jobs RENAME TO jobs_old;

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('build_course','ingest','review_project','reindex','explainers')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed','cancelled')),
  course_id TEXT,
  input TEXT NOT NULL DEFAULT '{}',
  output TEXT NOT NULL DEFAULT '{}',
  usage TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  worker_id TEXT,
  heartbeat_at TEXT
);

CREATE TABLE job_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  stage TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  payload TEXT NOT NULL DEFAULT '{}',
  at TEXT NOT NULL,
  UNIQUE (job_id, seq)
);

INSERT INTO jobs(id, kind, status, course_id, input, output, usage, error, attempts, cancel_requested, created_at,
                 started_at, finished_at, worker_id, heartbeat_at)
  SELECT id, kind, status, course_id, input, output, usage, error, attempts, cancel_requested, created_at,
         started_at, finished_at, worker_id, heartbeat_at FROM jobs_old;
INSERT INTO job_events(id, job_id, seq, stage, message, payload, at)
  SELECT id, job_id, seq, stage, message, payload, at FROM job_events_old;

DROP TABLE job_events_old;
DROP TABLE jobs_old;
CREATE INDEX jobs_status ON jobs(status, created_at);
