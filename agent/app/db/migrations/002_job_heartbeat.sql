-- Job leases: the worker that claimed a job and when it last proved it is alive. Jobs left 'running' with a
-- stale heartbeat (a dead process) are re-claimed; build_course then resumes its LangGraph thread.
ALTER TABLE jobs ADD COLUMN worker_id TEXT;
ALTER TABLE jobs ADD COLUMN heartbeat_at TEXT;
