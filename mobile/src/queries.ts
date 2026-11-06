/**
 * Query hooks for the reader. Same rule as the web app: screens read server state only through a
 * hook that calls a service in src/api/services, so every call is cached and has an MSW handler.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chapterService, courseService } from '@/api/services/coursewrightService';
import type { Chapter, CourseDetail } from '@/api/types';

export const readerKeys = {
  courses: ['reader', 'courses'] as const,
  course: (id: string) => ['reader', 'course', id] as const,
  chapter: (id: string) => ['reader', 'chapter', id] as const,
};

export function useCourses() {
  return useQuery({ queryKey: readerKeys.courses, queryFn: courseService.list });
}

export function useCourse(id: string | null) {
  return useQuery({
    queryKey: readerKeys.course(id ?? ''),
    queryFn: () => courseService.get(id as string),
    enabled: Boolean(id),
  });
}

export function useChapter(id: string) {
  return useQuery({ queryKey: readerKeys.chapter(id), queryFn: () => chapterService.get(id) });
}

/**
 * Mark a chapter started or read. The server overwrites `finishedAt` on every call, so callers send
 * `false` only for a chapter that was never started, and `true` once, at the end.
 */
export function useChapterProgress(chapterId: string, courseId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (finished: boolean) => chapterService.progress(chapterId, finished),
    onSuccess: () => {
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
    mutationFn: ({ questionId, chosen }: { questionId: string; chosen: number }) => chapterService.attempt(questionId, chosen),
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
