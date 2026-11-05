-- Coursewright schema v1. JSON columns are TEXT holding JSON; ids are UUID text.

CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  topic TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  brief TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning','building','ready','failed')),
  colour TEXT NOT NULL DEFAULT 'lime',
  icon TEXT NOT NULL DEFAULT '📘',
  job_id TEXT,
  last_opened_chapter_id TEXT,
  seed_key TEXT UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE modules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT ''
);
CREATE INDEX modules_course ON modules(course_id, position);

CREATE TABLE chapters (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  markdown TEXT NOT NULL DEFAULT '',
  reading_minutes INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'ready'
);
CREATE INDEX chapters_module ON chapters(module_id, position);
CREATE INDEX chapters_course ON chapters(course_id);

CREATE TABLE concepts (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT ''
);
CREATE INDEX concepts_course ON concepts(course_id);

CREATE TABLE concept_edges (
  from_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'prereq',
  PRIMARY KEY (from_id, to_id, kind)
);

CREATE TABLE chapter_concepts (
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  concept_id TEXT NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (chapter_id, concept_id)
);

CREATE TABLE diagrams (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  kind TEXT NOT NULL CHECK (kind IN ('flow','mermaid','svg','graph')),
  title TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL,
  checked_at TEXT
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  prompt TEXT NOT NULL,
  options TEXT NOT NULL,
  answer INTEGER NOT NULL,
  explanation TEXT NOT NULL DEFAULT '',
  concept_ids TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  chosen INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX attempts_question ON attempts(question_id, at);

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  brief TEXT NOT NULL DEFAULT '',
  starter TEXT NOT NULL DEFAULT '[]',
  hints TEXT NOT NULL DEFAULT '[]',
  rubric TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  check_cmd TEXT NOT NULL DEFAULT '',
  done_at TEXT
);

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
  repo_url TEXT NOT NULL,
  focus TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  job_id TEXT NOT NULL,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  findings TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE progress (
  chapter_id TEXT PRIMARY KEY REFERENCES chapters(id) ON DELETE CASCADE,
  started_at TEXT,
  finished_at TEXT,
  scroll_anchor TEXT
);

CREATE TABLE note_pages (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES note_pages(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT 'Untitled',
  icon TEXT NOT NULL DEFAULT '📄',
  cover TEXT,
  properties TEXT NOT NULL DEFAULT '{}',
  markdown TEXT NOT NULL DEFAULT '',
  course_id TEXT REFERENCES courses(id) ON DELETE SET NULL,
  chapter_id TEXT REFERENCES chapters(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  trashed_at TEXT
);
CREATE INDEX note_pages_parent ON note_pages(parent_id, position);

CREATE TABLE note_links (
  from_page_id TEXT NOT NULL REFERENCES note_pages(id) ON DELETE CASCADE,
  to_kind TEXT NOT NULL,
  to_id TEXT NOT NULL,
  PRIMARY KEY (from_page_id, to_kind, to_id)
);
CREATE INDEX note_links_to ON note_links(to_kind, to_id);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('chapter','note','url','tutor')),
  title TEXT NOT NULL DEFAULT '',
  uri TEXT,
  ref_id TEXT,
  course_id TEXT,
  chapter_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','indexed','failed')),
  error TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX sources_ref ON sources(kind, ref_id) WHERE ref_id IS NOT NULL;

CREATE TABLE chunks (
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  course_id TEXT,
  chapter_id TEXT,
  anchor TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  context TEXT NOT NULL DEFAULT '',
  content_hash TEXT NOT NULL,
  embed_model TEXT NOT NULL
);
CREATE INDEX chunks_source ON chunks(source_id);
CREATE INDEX chunks_course ON chunks(course_id);

-- Vector index (sqlite-vec, brute force) and keyword index (FTS5), both keyed by chunks.rowid.
CREATE VIRTUAL TABLE chunk_vectors USING vec0(embedding float[1024] distance_metric=cosine);
CREATE VIRTUAL TABLE chunks_fts USING fts5(text, context, title, tokenize = 'porter unicode61');

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('build_course','ingest','review_project','reindex')),
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
  finished_at TEXT
);
CREATE INDEX jobs_status ON jobs(status, created_at);

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

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
