/**
 * Coursewright API services: one object per resource, each the single place
 * that knows its HTTP routes (docs/plan/api-contract.md). Query hooks in
 * `src/hooks/` call these; components never do.
 */
import apiClient, { extractData } from '../client';
import type {
  ApiResponse,
  Chapter,
  CourseBrief,
  CourseDetail,
  CourseSummary,
  Health,
  IndexStats,
  InterviewStep,
  Job,
  Milestone,
  NotePage,
  NoteSummary,
  Project,
  SearchHit,
  Source,
  Submission,
} from '../types';

type Body = Record<string, unknown>;

async function get<T>(url: string, params?: Body): Promise<T> {
  return extractData(await apiClient.get<ApiResponse<T>>(url, { params }));
}
async function post<T>(url: string, body?: Body): Promise<T> {
  return extractData(await apiClient.post<ApiResponse<T>>(url, body ?? {}));
}
async function patch<T>(url: string, body: Body): Promise<T> {
  return extractData(await apiClient.patch<ApiResponse<T>>(url, body));
}
async function del<T>(url: string): Promise<T> {
  return extractData(await apiClient.delete<ApiResponse<T>>(url));
}

export const healthService = {
  get: () => get<Health>('/health'),
};

export interface InterviewAnswer {
  question: string;
  answer: string[];
  /** The question's short header ("Level"), so the server can catch a repeated question. */
  header?: string;
}

export const interviewService = {
  next: (topic: string, answers: InterviewAnswer[]) =>
    post<InterviewStep>('/interview/next', { topic, answers }),
};

export const courseService = {
  list: () => get<CourseSummary[]>('/courses'),
  get: (id: string) => get<CourseDetail>(`/courses/${id}`),
  create: (brief: CourseBrief) =>
    post<{ course: CourseSummary; jobId: string }>('/courses', { brief }),
  remove: (id: string) => del<{ ok: true }>(`/courses/${id}`),
  /** Continue a stopped build: the same job runs again from its checkpoint and the files it already wrote. */
  resume: (id: string) => post<{ course: CourseSummary; jobId: string }>(`/courses/${id}/resume`, {}),
};

export const chapterService = {
  get: (id: string) => get<Chapter>(`/chapters/${id}`),
  progress: (id: string, finished: boolean) =>
    post<{ startedAt: string | null; finishedAt: string | null }>(`/chapters/${id}/progress`, {
      finished,
    }),
  attempt: (questionId: string, chosen: number) =>
    post<{ correct: boolean; answer: number; explanation: string }>(
      `/questions/${questionId}/attempts`,
      { chosen }
    ),
};

export const projectService = {
  get: (id: string) => get<Project>(`/projects/${id}`),
  setMilestone: (id: string, done: boolean) => patch<Milestone>(`/milestones/${id}`, { done }),
  submit: (projectId: string, body: { repoUrl: string; milestoneId?: string | null; focus?: string }) =>
    post<Submission>(`/projects/${projectId}/submissions`, body),
  submission: (id: string) => get<Submission>(`/submissions/${id}`),
};

export interface NoteCreate {
  parentId?: string | null;
  title?: string;
  icon?: string;
  markdown?: string;
  courseId?: string | null;
  chapterId?: string | null;
}
export type NotePatch = Partial<
  Pick<NotePage, 'title' | 'icon' | 'cover' | 'markdown' | 'parentId' | 'position' | 'properties'>
>;

export const noteService = {
  tree: () => get<NoteSummary[]>('/notes/tree'),
  recent: () => get<NoteSummary[]>('/notes/recent'),
  search: (q: string) =>
    get<{ id: string; title: string; icon: string; snippet: string }[]>('/notes/search', { q }),
  get: (id: string) => get<NotePage>(`/notes/${id}`),
  create: (body: NoteCreate) => post<NotePage>('/notes', body as Body),
  update: (id: string, body: NotePatch) => patch<NotePage>(`/notes/${id}`, body as Body),
  remove: (id: string) => del<{ ok: true }>(`/notes/${id}`),
};

export const sourceService = {
  list: () => get<Source[]>('/sources'),
  stats: () => get<IndexStats>('/sources/stats'),
  addUrl: (uri: string) => post<Source>('/sources', { kind: 'url', uri }),
  reindex: () => post<{ jobId: string }>('/sources/reindex'),
  search: (query: string, courseId?: string | null, k = 8) =>
    post<SearchHit[]>('/search/test', { query, courseId: courseId ?? null, k }),
};

export const jobService = {
  get: (id: string) => get<Job>(`/jobs/${id}`),
  cancel: (id: string) => post<Job>(`/jobs/${id}/cancel`),
  /** The SSE stream URL (EventSource can't go through axios). */
  eventsUrl: (id: string, after = 0) =>
    `${import.meta.env.VITE_API_BASE_URL || '/api'}/jobs/${id}/events?after=${after}`,
};
