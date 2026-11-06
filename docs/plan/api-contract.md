# API contract (v1)

The frontend (`src/api/`) and the Python service (`agent/`) both follow this file. All REST routes live under
the `/api` prefix (FastAPI mounts its routers at `/api`; Vite proxies `/api` to `http://localhost:8123`).
Every JSON response is wrapped in `{ "data": <payload> }`. Errors are `{ "message": string }` with a 4xx/5xx
status. Field names are camelCase on the wire. Ids are UUID strings. Timestamps are ISO 8601 strings.

Deviation from architecture.md: the interview runs over REST (`/api/interview/next`) instead of an AG-UI
interrupt, so course creation does not depend on CopilotKit. The tutor still runs over AG-UI + CopilotKit.
Notes and chapters store markdown (kit `blocks` reads and writes markdown), not a JSON block tree.

## Types

```ts
type CourseStatus = 'planning' | 'building' | 'ready' | 'failed';

interface CourseSummary {
  id: string; title: string; topic: string; status: CourseStatus; colour: string; // mantine colour name
  icon: string;               // one emoji
  createdAt: string;
  moduleCount: number; chapterCount: number; projectCount: number;
  chaptersDone: number;
  jobId: string | null;       // the build job while status is planning/building
  lastOpenedChapterId: string | null;
  outlineReady: boolean;      // the build stopped at its outline and waits for you to review it
}

interface CourseBrief {
  topic: string;
  answers: { question: string; answer: string[] }[];
  level?: string; goal?: string; pace?: string;   // filled by the interviewer when known
  reviewOutline?: boolean;    // default true: stop after the outline so it can be changed first
}

// The outline a build pauses on (the course file format's outline; chapters carry a one-line summary).
interface CoursePlan {
  courseId: string; status: CourseStatus;
  outline: { title: string; concepts: {key, name, summary}[]; edges: {from, to}[];
             modules: { key: string; title: string; projectKey: string | null;
                        chapters: { key: string; title: string; summary: string; conceptKeys: string[] }[] }[] };
  messages: { role: 'user' | 'agent'; text: string; at: string; changed?: string[] }[];
  estimate: { tokens: number };  // rough cost to write this outline
  approvedAt: string | null;
}

interface ChapterRef { id: string; position: number; title: string; readingMinutes: number; done: boolean }
interface ProjectRef { id: string; title: string; milestonesDone: number; milestonesTotal: number }
interface ModuleOut { id: string; position: number; title: string; summary: string;
  chapters: ChapterRef[]; project: ProjectRef | null }
interface Concept { id: string; name: string; summary: string }
interface WeakSpot { conceptId: string; name: string; wrong: number }

interface CourseDetail extends CourseSummary {
  brief: CourseBrief; summary: string;
  modules: ModuleOut[]; concepts: Concept[]; edges: { from: string; to: string }[];
  weakSpots: WeakSpot[];
}

interface Question { id: string; prompt: string; options: string[]; answer: number; explanation: string;
  conceptIds: string[]; lastAttempt: { chosen: number; correct: boolean } | null }
interface Diagram { id: string; kind: 'flow' | 'mermaid' | 'svg'; title: string; source: string }

interface Chapter {
  id: string; courseId: string; courseTitle: string; moduleId: string; moduleTitle: string;
  position: number; title: string; markdown: string; readingMinutes: number;
  questions: Question[]; diagrams: Diagram[];
  prev: { id: string; title: string } | null; next: { id: string; title: string } | null;
  startedAt: string | null; finishedAt: string | null;
}

interface Milestone { id: string; position: number; title: string; body: string; checkCmd: string; doneAt: string | null }
interface Finding { kind: 'pass' | 'fix' | 'idea'; title: string; body: string; chapterId: string | null }
interface Submission { id: string; projectId: string; milestoneId: string | null; repoUrl: string; focus: string;
  status: 'queued' | 'running' | 'done' | 'failed'; jobId: string; createdAt: string;
  findings: Finding[]; error: string | null }
interface Project {
  id: string; courseId: string; courseTitle: string; moduleId: string; moduleTitle: string;
  title: string; brief: string;                         // markdown
  starter: { path: string; note: string }[];
  hints: string[]; rubric: { criterion: string; chapterId: string | null }[];
  milestones: Milestone[]; submissions: Submission[];
}

interface NoteSummary { id: string; parentId: string | null; position: number; title: string; icon: string;
  courseId: string | null; chapterId: string | null; updatedAt: string }
interface NotePage extends NoteSummary { cover: string | null; properties: Record<string, string>; markdown: string;
  backlinks: { id: string; title: string; icon: string }[] }

type SourceKind = 'chapter' | 'note' | 'url' | 'tutor';
interface Source { id: string; kind: SourceKind; title: string; uri: string | null; courseId: string | null;
  status: 'pending' | 'indexed' | 'failed'; chunkCount: number; error: string | null; updatedAt: string }
interface IndexStats { sources: number; chunks: number; courses: number; embedModel: string; dims: number;
  embedder: 'voyage' | 'local' }   // 'local' = hashed fallback when VOYAGE_API_KEY is missing
interface SearchHit { chunkId: string; sourceId: string; title: string; text: string; context: string;
  score: number; courseId: string | null; chapterId: string | null; anchor: string | null }

interface Job { id: string; kind: 'build_course' | 'ingest' | 'review_project' | 'reindex';
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'; courseId: string | null;
  error: string | null; createdAt: string; usage: { inputTokens: number; outputTokens: number } | null }
type Stage = 'research' | 'concepts' | 'outline' | 'chapters' | 'projects' | 'index' | 'done';
interface JobEvent { id: number; seq: number; stage: Stage; message: string;
  payload: Record<string, unknown>; at: string }
// payload hints the Generating screen uses (all optional):
//   research: { terms: string[] }   concepts: { concepts: string[] }   outline: { modules: string[] }
//   chapters: { chapter: string, done: number, total: number }   projects: { projects: string[] }
//   index: { chunks: number }        done: { courseId: string }

interface InterviewQuestion { id: string; header: string; question: string; multiSelect: boolean;
  options: { label: string; description: string; recommended?: boolean }[] }
interface InterviewStep { question: InterviewQuestion | null; done: boolean; summary: string | null;
  level?: string; goal?: string; pace?: string }   // filled when done, to complete CourseBrief

interface Health { ok: boolean; anthropic: boolean; voyage: boolean; version: string;
  model?: string; provider?: string }   // provider: 'anthropic' or the compatible base URL
```

## Routes (all under `/api`)

```
GET    /health                                   -> Health
POST   /interview/next   {topic, answers}         -> InterviewStep   (max 6 questions; done=true when enough)
GET    /courses                                  -> CourseSummary[]
POST   /courses          {brief: CourseBrief}     -> {course: CourseSummary, jobId}
GET    /courses/:id                              -> CourseDetail
POST   /courses/:id/resume                       -> {course, jobId}   (continue a stopped build)
GET    /courses/:id/plan                         -> CoursePlan
POST   /courses/:id/plan/chat   {message}        -> CoursePlan & {reply, changed: chapterKey[]}  (502: outline unchanged)
POST   /courses/:id/plan/remove {chapterKey}     -> CoursePlan   (no model call; 409 for a module's last chapter)
POST   /courses/:id/plan/approve                 -> {course, jobId}   (queues the writing job)
DELETE /courses/:id                              -> {ok: true}
GET    /chapters/:id                             -> Chapter
POST   /chapters/:id/progress {finished: bool}   -> {startedAt, finishedAt}
POST   /questions/:id/attempts {chosen: number}  -> {correct, answer, explanation}
GET    /projects/:id                             -> Project
PATCH  /milestones/:id   {done: bool}            -> Milestone
POST   /projects/:id/submissions {repoUrl, milestoneId?, focus?} -> Submission
GET    /submissions/:id                          -> Submission
GET    /notes/tree                               -> NoteSummary[]   (flat; build the tree on the client)
GET    /notes/recent                             -> NoteSummary[]   (8 most recent)
GET    /notes/search?q=                          -> {id, title, icon, snippet}[]
POST   /notes            {parentId?, title?, icon?, markdown?, courseId?, chapterId?} -> NotePage
GET    /notes/:id                                -> NotePage
PATCH  /notes/:id        partial {title, icon, cover, markdown, parentId, position, properties} -> NotePage
DELETE /notes/:id                                -> {ok: true}   (also deletes children)
GET    /sources                                  -> Source[]
GET    /sources/stats                            -> IndexStats
POST   /sources          {kind: 'url', uri}       -> Source  (creates an ingest job)
POST   /sources/reindex                          -> {jobId}
POST   /search/test      {query, courseId?, k?}   -> SearchHit[]
GET    /jobs/:id                                 -> Job
POST   /jobs/:id/cancel                          -> Job
GET    /jobs/:id/events?after=<seq>              -> text/event-stream, one `data: <JobEvent JSON>` per event,
                                                    replays from `after`, closes after a `done` stage or a
                                                    failed/cancelled job
```

## AG-UI

`POST /agents/tutor` (not under `/api`): the tutor deep agent, mounted with `add_langgraph_fastapi_endpoint`.
The CopilotKit runtime (Node, `runtime-dev/server.ts`, port 4000, path `/api/copilotkit`) registers it as
agent `tutor` through `HttpAgent({ url: 'http://localhost:8123/agents/tutor' })`.

Frontend context the tutor receives through CopilotKit: `courseId`, `chapterId`, `selection`, `noteId`.
Frontend tools: `save_to_notes(markdown, title?)`, `open_chapter(courseId, chapterId)`,
`highlight_passage(chapterId, text, courseId?)`, `start_quiz(questions)`.

Tutor backend tool results the chat renders (JSON strings):
- `search_course` → `{query, hits: [{n, chunkId, title, chapterId, courseId, text}], note?}` (cite as `[n]`)
- `make_flow` → `{kind: 'flow' | 'mermaid', title, source}` (flow sources pass the Flowmovie checker)
- `make_quiz` → `{questions: [{prompt, options, answer, explanation, chapterId}], note?}`

Context may also carry `webSearch: true` to let the tutor use web search for that turn.

## Notes from the implementation

- SSE events also carry an `id: <seq>` line; `Last-Event-ID` is honoured on reconnect.
- Ingest and reindex jobs emit `index` then `done`. `review_project` emits `research` (`{files}`) and `done`
  (`{submissionId}`).
- `CourseSummary.jobId` stays set when a build `failed`, so the Generating screen can show the error.
- `POST /projects/:id/submissions` returns 503 without `ANTHROPIC_API_KEY` and 422 for a non-GitHub URL.
- `GET /chapters/:id` records the chapter as the course's `lastOpenedChapterId`.
- The tutor reads frontend context from CopilotKit's `context` items (the web app sends one item whose value
  is `{courseId, chapterId, noteId, selection}`); frontend tools arrive through `CopilotKitMiddleware`.
