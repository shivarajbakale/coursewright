/**
 * Query and mutation hooks for every Coursewright resource. Components read
 * server state only through these. Keys live in `cwKeys` so reads and
 * invalidations agree.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationKeys } from '@/hooks/useNotifications';
import { toast } from '@/lib/notify';
import {
  chapterService,
  courseService,
  healthService,
  interviewService,
  jobService,
  noteService,
  projectService,
  sourceService,
  type InterviewAnswer,
  type NoteCreate,
  type NotePatch,
} from '@/api/services/coursewrightService';
import type { CourseBrief, JobEvent } from '@/api/types';

export const cwKeys = {
  health: ['health'] as const,
  courses: ['courses'] as const,
  course: (id: string) => ['courses', id] as const,
  chapter: (id: string) => ['chapters', id] as const,
  project: (id: string) => ['projects', id] as const,
  submission: (id: string) => ['submissions', id] as const,
  notes: ['notes'] as const,
  noteTree: ['notes', 'tree'] as const,
  noteRecent: ['notes', 'recent'] as const,
  noteSearch: (q: string) => ['notes', 'search', q] as const,
  note: (id: string) => ['notes', 'page', id] as const,
  sources: ['sources'] as const,
  sourceStats: ['sources', 'stats'] as const,
  job: (id: string) => ['jobs', id] as const,
};

// ── Health ────────────────────────────────────────────────────────────────
export function useHealth() {
  return useQuery({ queryKey: cwKeys.health, queryFn: healthService.get, staleTime: 60_000, retry: 0 });
}

// ── Interview ─────────────────────────────────────────────────────────────
export function useInterviewNext() {
  return useMutation({
    mutationFn: ({ topic, answers }: { topic: string; answers: InterviewAnswer[] }) =>
      interviewService.next(topic, answers),
    onError: (e: { message?: string }) => toast.error(e.message ?? 'The interviewer could not answer'),
  });
}

// ── Courses ───────────────────────────────────────────────────────────────
export function useCourses() {
  return useQuery({ queryKey: cwKeys.courses, queryFn: courseService.list, staleTime: 10_000 });
}

export function useCourse(id: string) {
  return useQuery({ queryKey: cwKeys.course(id), queryFn: () => courseService.get(id), enabled: !!id });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (brief: CourseBrief) => courseService.create(brief),
    onSuccess: () => qc.invalidateQueries({ queryKey: cwKeys.courses }),
    onError: (e: { message?: string }) => toast.error(e.message ?? 'Could not start the course'),
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => courseService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cwKeys.courses });
      toast.success('Course deleted');
    },
    onError: () => toast.error('Could not delete the course'),
  });
}

// ── Chapters ──────────────────────────────────────────────────────────────
export function useChapter(id: string) {
  return useQuery({ queryKey: cwKeys.chapter(id), queryFn: () => chapterService.get(id), enabled: !!id });
}

export function useChapterProgress(chapterId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (finished: boolean) => chapterService.progress(chapterId, finished),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cwKeys.chapter(chapterId) });
      qc.invalidateQueries({ queryKey: cwKeys.course(courseId) });
      qc.invalidateQueries({ queryKey: cwKeys.courses });
    },
  });
}

export function useAttempt(chapterId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, chosen }: { questionId: string; chosen: number }) =>
      chapterService.attempt(questionId, chosen),
    onSuccess: () => qc.invalidateQueries({ queryKey: cwKeys.chapter(chapterId) }),
  });
}

// ── Projects ──────────────────────────────────────────────────────────────
export function useProject(id: string) {
  return useQuery({ queryKey: cwKeys.project(id), queryFn: () => projectService.get(id), enabled: !!id });
}

export function useToggleMilestone(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) => projectService.setMilestone(id, done),
    onSuccess: () => qc.invalidateQueries({ queryKey: cwKeys.project(projectId) }),
  });
}

export function useSubmitProject(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { repoUrl: string; milestoneId?: string | null; focus?: string }) =>
      projectService.submit(projectId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cwKeys.project(projectId) });
      toast.success('Submitted for review');
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? 'Could not submit'),
  });
}

/** Polls a submission until its review finishes. */
export function useSubmission(id: string | null) {
  return useQuery({
    queryKey: cwKeys.submission(id ?? ''),
    queryFn: () => projectService.submission(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return s === 'done' || s === 'failed' ? false : 2000;
    },
  });
}

// ── Notes ─────────────────────────────────────────────────────────────────
export function useNoteTree() {
  return useQuery({ queryKey: cwKeys.noteTree, queryFn: noteService.tree });
}

export function useRecentNotes() {
  return useQuery({ queryKey: cwKeys.noteRecent, queryFn: noteService.recent });
}

export function useNoteSearch(q: string) {
  return useQuery({
    queryKey: cwKeys.noteSearch(q),
    queryFn: () => noteService.search(q),
    enabled: q.trim().length > 1,
  });
}

export function useNote(id: string | undefined) {
  return useQuery({
    queryKey: cwKeys.note(id ?? ''),
    queryFn: () => noteService.get(id!),
    enabled: !!id,
    staleTime: Infinity,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NoteCreate) => noteService.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: cwKeys.notes }),
    onError: () => toast.error('Could not create the page'),
  });
}

/** Saves a page. Tree-visible fields refresh the tree; markdown edits don't. */
export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: NotePatch }) => noteService.update(id, patch),
    onSuccess: (page, { patch }) => {
      qc.setQueryData(cwKeys.note(page.id), page);
      if ('title' in patch || 'icon' in patch || 'parentId' in patch || 'position' in patch) {
        qc.invalidateQueries({ queryKey: cwKeys.noteTree });
      }
      qc.invalidateQueries({ queryKey: cwKeys.noteRecent });
    },
    onError: () => toast.error('Could not save the page'),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => noteService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: cwKeys.notes }),
    onError: () => toast.error('Could not delete the page'),
  });
}

// ── Sources / RAG ─────────────────────────────────────────────────────────
export function useSources() {
  return useQuery({ queryKey: cwKeys.sources, queryFn: sourceService.list, refetchInterval: 5000 });
}

export function useIndexStats() {
  return useQuery({ queryKey: cwKeys.sourceStats, queryFn: sourceService.stats });
}

export function useAddSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uri: string) => sourceService.addUrl(uri),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cwKeys.sources });
      toast.success('Added. Indexing in the background');
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? 'Could not add the source'),
  });
}

export function useReindex() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => sourceService.reindex(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cwKeys.sources });
      toast.success('Re-indexing started');
    },
  });
}

export function useSearchTest() {
  return useMutation({
    mutationFn: ({ query, courseId }: { query: string; courseId?: string | null }) =>
      sourceService.search(query, courseId),
  });
}

// ── Jobs ──────────────────────────────────────────────────────────────────
export function useJob(id: string | null | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: cwKeys.job(id ?? ''),
    queryFn: () => jobService.get(id!),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data?.status === 'running' || q.state.data?.status === 'queued' ? 3000 : false),
  });
  // A watched job that ends has just written its notification: show it now, not on the next 30 s poll.
  const status = query.data?.status;
  const ended = status === 'done' || status === 'failed';
  useEffect(() => {
    if (ended) void qc.invalidateQueries({ queryKey: notificationKeys.all });
  }, [ended, qc]);
  return query;
}

export function useCancelJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => jobService.cancel(id),
    onSuccess: (job) => {
      qc.setQueryData(cwKeys.job(job.id), job);
      qc.invalidateQueries({ queryKey: cwKeys.courses });
    },
  });
}

/**
 * Streams a job's events over SSE. Events are stored server-side, so a
 * reconnect (or a refreshed page) replays from the start and nothing is lost.
 */
export function useJobEvents(jobId: string | null | undefined) {
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    setEvents([]);
    setClosed(false);
    let lastSeq = 0;
    const source = new EventSource(jobService.eventsUrl(jobId, 0));
    source.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as JobEvent;
        if (ev.seq <= lastSeq) return;
        lastSeq = ev.seq;
        setEvents((prev) => [...prev, ev]);
        if (ev.stage === 'done') {
          source.close();
          setClosed(true);
        }
      } catch {
        /* ignore keep-alives */
      }
    };
    source.onerror = () => {
      // The server closes the stream when the job ends; EventSource would retry forever.
      source.close();
      setClosed(true);
    };
    return () => source.close();
  }, [jobId]);

  return { events, closed };
}
