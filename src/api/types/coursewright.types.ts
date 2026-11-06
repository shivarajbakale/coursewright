/**
 * Coursewright domain types. Mirrors docs/plan/api-contract.md exactly; the
 * Python service (agent/) serves the same shapes under the `{ data }` envelope.
 * Pure types, no runtime imports.
 */

export type CourseStatus = 'planning' | 'building' | 'ready' | 'failed';

export interface CourseSummary {
  id: string; title: string; topic: string; status: CourseStatus; colour: string; // mantine colour name
  icon: string;               // one emoji
  createdAt: string;
  moduleCount: number; chapterCount: number; projectCount: number;
  chaptersDone: number;
  jobId: string | null;       // the build job while status is planning/building
  lastOpenedChapterId: string | null;
  outlineReady: boolean;      // the build stopped at its outline and waits for you to review it
}

export interface CourseBrief {
  topic: string;
  answers: { question: string; answer: string[] }[];
  level?: string; goal?: string; pace?: string;   // filled by the interviewer when known
  reviewOutline?: boolean;    // stop after the outline so you can change it before anything is written
}

/** The outline a build pauses on: the course file format's outline (agent/app/materialise.py). */
export interface PlanChapter { key: string; title: string; summary: string; readingMinutes: number; conceptKeys: string[] }
export interface PlanModule { key: string; title: string; summary: string; chapters: PlanChapter[]; projectKey: string | null }
export interface PlanOutline {
  title: string; topic: string; summary: string; colour: string; icon: string;
  concepts: { key: string; name: string; summary: string }[];
  edges: { from: string; to: string }[];
  modules: PlanModule[];
}
export interface PlanMessage { role: 'user' | 'agent'; text: string; at: string; changed?: string[] }
export interface CoursePlan {
  courseId: string; status: CourseStatus; outline: PlanOutline; messages: PlanMessage[];
  estimate: { tokens: number }; approvedAt: string | null;
}
export interface PlanChatResult extends CoursePlan { reply: string; changed: string[] }

export interface ChapterRef { id: string; position: number; title: string; readingMinutes: number; done: boolean }
export interface ProjectRef { id: string; title: string; milestonesDone: number; milestonesTotal: number }
export interface ModuleOut { id: string; position: number; title: string; summary: string;
  chapters: ChapterRef[]; project: ProjectRef | null }
export interface Concept { id: string; name: string; summary: string }
export interface WeakSpot { conceptId: string; name: string; wrong: number }

export interface CourseDetail extends CourseSummary {
  brief: CourseBrief; summary: string;
  modules: ModuleOut[]; concepts: Concept[]; edges: { from: string; to: string }[];
  weakSpots: WeakSpot[];
}

export interface Question { id: string; prompt: string; options: string[]; answer: number; explanation: string;
  conceptIds: string[]; lastAttempt: { chosen: number; correct: boolean } | null }
export interface Diagram { id: string; kind: 'flow' | 'mermaid' | 'svg'; title: string; source: string }

export interface Chapter {
  id: string; courseId: string; courseTitle: string; moduleId: string; moduleTitle: string;
  position: number; title: string; markdown: string; readingMinutes: number;
  questions: Question[]; diagrams: Diagram[];
  prev: { id: string; title: string } | null; next: { id: string; title: string } | null;
  startedAt: string | null; finishedAt: string | null;
}

export interface Milestone { id: string; position: number; title: string; body: string; checkCmd: string; doneAt: string | null }
export interface Finding { kind: 'pass' | 'fix' | 'idea'; title: string; body: string; chapterId: string | null }
export interface Submission { id: string; projectId: string; milestoneId: string | null; repoUrl: string; focus: string;
  status: 'queued' | 'running' | 'done' | 'failed'; jobId: string; createdAt: string;
  findings: Finding[]; error: string | null }
export interface Project {
  id: string; courseId: string; courseTitle: string; moduleId: string; moduleTitle: string;
  title: string; brief: string;                         // markdown
  starter: { path: string; note: string }[];
  hints: string[]; rubric: { criterion: string; chapterId: string | null }[];
  milestones: Milestone[]; submissions: Submission[];
}

export interface NoteSummary { id: string; parentId: string | null; position: number; title: string; icon: string;
  courseId: string | null; chapterId: string | null; updatedAt: string }
export interface NotePage extends NoteSummary { cover: string | null; properties: Record<string, string>; markdown: string;
  backlinks: { id: string; title: string; icon: string }[] }

export type SourceKind = 'chapter' | 'note' | 'url' | 'tutor';
export interface Source { id: string; kind: SourceKind; title: string; uri: string | null; courseId: string | null;
  status: 'pending' | 'indexed' | 'failed'; chunkCount: number; error: string | null; updatedAt: string }
export interface IndexStats { sources: number; chunks: number; courses: number; embedModel: string; dims: number;
  embedder: 'voyage' | 'local' }   // 'local' = hashed fallback when VOYAGE_API_KEY is missing
export interface SearchHit { chunkId: string; sourceId: string; title: string; text: string; context: string;
  score: number; courseId: string | null; chapterId: string | null; anchor: string | null }

export interface Job { id: string; kind: 'build_course' | 'ingest' | 'review_project' | 'reindex';
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled'; courseId: string | null;
  error: string | null; createdAt: string; usage: { inputTokens: number; outputTokens: number } | null }
export type Stage = 'research' | 'concepts' | 'outline' | 'chapters' | 'projects' | 'index' | 'done';
export interface JobEvent { id: number; seq: number; stage: Stage; message: string;
  payload: Record<string, unknown>; at: string }
// payload hints the Generating screen uses (all optional):
//   research: { terms: string[] }   concepts: { concepts: string[] }   outline: { modules: string[] }
//   chapters: { chapter: string, done: number, total: number }   projects: { projects: string[] }
//   index: { chunks: number }        done: { courseId: string }

export interface InterviewQuestion { id: string; header: string; question: string; multiSelect: boolean;
  options: { label: string; description: string; recommended?: boolean }[] }
export interface InterviewStep { question: InterviewQuestion | null; done: boolean; summary: string | null;
  level?: string; goal?: string; pace?: string }

export interface Health { ok: boolean; anthropic: boolean; voyage: boolean; version: string;
  model?: string; provider?: string }   // provider: 'anthropic' or the compatible base URL
