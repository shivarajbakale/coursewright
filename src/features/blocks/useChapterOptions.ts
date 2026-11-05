import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { courseService } from '@/api/services/coursewrightService';
import { cwKeys, useCourses } from '@/hooks/useCoursewright';
import type { ChapterOption } from './model';

/**
 * Every chapter of the user's ready courses as one flat list, numbered
 * "module.chapter" (3.2), for "@" chapter mentions. Each course's detail is
 * loaded through the same query key `useCourse` uses, so it is shared.
 */
export function useChapterOptions(): ChapterOption[] {
  const courses = useCourses();
  const ready = useMemo(() => (courses.data ?? []).filter((c) => c.status === 'ready'), [courses.data]);
  const details = useQueries({
    queries: ready.map((c) => ({
      queryKey: cwKeys.course(c.id),
      queryFn: () => courseService.get(c.id),
      staleTime: 60_000,
    })),
  });
  const loaded = details.map((d) => d.data);
  // Changes only when a course's detail (re)loads, so the list is rebuilt only then.
  const stamp = details.map((d) => `${d.dataUpdatedAt}`).join(',');
  return useMemo(() => {
    const out: ChapterOption[] = [];
    for (const course of loaded) {
      if (!course) continue;
      const modules = [...course.modules].sort((a, b) => a.position - b.position);
      modules.forEach((m, mi) => {
        [...m.chapters]
          .sort((a, b) => a.position - b.position)
          .forEach((ch, ci) =>
            out.push({
              courseId: course.id,
              courseTitle: course.title,
              chapterId: ch.id,
              number: `${mi + 1}.${ci + 1}`,
              title: ch.title,
            })
          );
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp]);
}
