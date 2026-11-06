/**
 * Query hooks for the reader. Same rule as the web app: screens read server state only through a
 * hook that calls a service in src/api/services, so every call is cached and has an MSW handler.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chapterService, courseService } from '@/api/services/coursewrightService';
import type { Chapter, CourseDetail } from '@/api/types';
import { enqueue, isRetryable } from './offline/outbox';
import { isOnline } from './offline/online';

// TanStack Query pauses requests while the browser says it is offline. The reader's requests must still
// go out: the service worker answers them from what is saved on the device, and the outbox keeps writes.
const reads = { networkMode: 'offlineFirst' } as const;
const writes = { networkMode: 'always' } as const;

export const readerKeys = {
  courses: ['reader', 'courses'] as const,
  course: (id: string) => ['reader', 'course', id] as const,
  chapter: (id: string) => ['reader', 'chapter', id] as const,
};

export function useCourses() {
  return useQuery({ ...reads, queryKey: readerKeys.courses, queryFn: courseService.list });
}

export function useCourse(id: string | null) {
  return useQuery({
    ...reads,
    queryKey: readerKeys.course(id ?? ''),
    queryFn: () => courseService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useChapter(id: string) {
  return useQuery({ ...reads, queryKey: readerKeys.chapter(id), queryFn: () => chapterService.get(id) });
}

/**
 * Mark a chapter started or read. The server overwrites `finishedAt` on every call, so callers send
 * `false` only for a chapter that was never started, and `true` once, at the end.
 */
export function useChapterProgress(chapterId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...writes,
    // Offline, or the request fails for lack of a connection: kept on the device (offline/outbox.ts) and
    // marked in the cached chapter, so the reader sees it at once and the server hears it later.
    mutationFn: async (finished: boolean) => {
      const keep = () => {
        enqueue({ kind: 'progress', chapterId, finished });
        const at = new Date().toISOString();
        qc.setQueryData<Chapter>(readerKeys.chapter(chapterId), (ch) =>
          ch ? { ...ch, startedAt: ch.startedAt ?? at, finishedAt: finished ? at : ch.finishedAt } : ch,
        );
        if (finished)
          qc.setQueryData<CourseDetail>(readerKeys.course(courseId), (c) =>
            c ? { ...c, modules: c.modules.map((m) => ({ ...m, chapters: m.chapters.map((x) => (x.id === chapterId ? { ...x, done: true } : x)) })) } : c,
          );
        return { queued: true };
      };
      if (!isOnline()) return keep();
      try {
        await chapterService.progress(chapterId, finished);
        return { queued: false };
      } catch (e) {
        if (isRetryable(e)) return keep();
        throw e;
      }
    },
    onSuccess: ({ queued }) => {
      if (queued) return;
      void qc.invalidateQueries({ queryKey: readerKeys.chapter(chapterId) });
      void qc.invalidateQueries({ queryKey: readerKeys.course(courseId) });
      void qc.invalidateQueries({ queryKey: readerKeys.courses });
    },
  });
}

/** Where a chapter sits in its course: its number counting from 1, and the course's total. */
export function chapterNumber(course: CourseDetail | undefined, chapterId: string): { n: number; total: number } | null {
  if (!course) return null;
  const all = course.modules.flatMap((m) => m.chapters);
  const i = all.findIndex((c) => c.id === chapterId);
  return i < 0 ? null : { n: i + 1, total: all.length };
}

/**
 * Save an answer. The result goes straight into the cached chapter's question, so the chapter is
 * not refetched and the reading position does not move.
 */
export function useAnswer(chapterId: string) {
  const qc = useQueryClient();
  return useMutation({
    ...writes,
    mutationFn: async ({ questionId, chosen }: { questionId: string; chosen: number }) => {
      // The answer comes with the chapter, so offline the device checks it and the attempt is sent later.
      const keep = () => {
        const q = qc.getQueryData<Chapter>(readerKeys.chapter(chapterId))?.questions.find((x) => x.id === questionId);
        if (!q) throw new Error('This question is not on this device.');
        enqueue({ kind: 'attempt', questionId, chapterId, chosen });
        return { correct: chosen === q.answer, answer: q.answer, explanation: q.explanation };
      };
      if (!isOnline()) return keep();
      try {
        return await chapterService.attempt(questionId, chosen);
      } catch (e) {
        if (isRetryable(e)) return keep();
        throw e;
      }
    },
    onSuccess: (result, { questionId, chosen }) => {
      qc.setQueryData<Chapter>(readerKeys.chapter(chapterId), (ch) =>
        ch
          ? {
              ...ch,
              questions: ch.questions.map((q) => (q.id === questionId ? { ...q, lastAttempt: { chosen, correct: result.correct } } : q)),
            }
          : ch,
      );
    },
  });
}
