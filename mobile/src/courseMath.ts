/** Small pure helpers the reader's screens share. Kept out of component files so fast refresh works. */
import type { CourseDetail } from '@/api/types';
import { breakpoint } from './theme';

export type Layout = 'narrow' | 'medium' | 'split';

/** Under 700 px one column; from 700 px the outline is a drawer; from 1024 px it sits beside the chapter. */
export function layoutFor(width: number): Layout {
  if (width >= breakpoint.split) return 'split';
  if (width >= breakpoint.wide) return 'medium';
  return 'narrow';
}

/** Lesson titles are `<concept>: <plain words>`; the outline and the next-chapter button show the concept. */
export function shortTitle(title: string): string {
  const i = title.indexOf(':');
  return i > 0 ? title.slice(0, i) : title;
}

/** The chapter "Continue" opens: the last one opened, else the first not yet read, else the first. */
export function nextUp(course: CourseDetail): string | null {
  const all = course.modules.flatMap((m) => m.chapters);
  if (course.lastOpenedChapterId && all.some((c) => c.id === course.lastOpenedChapterId)) return course.lastOpenedChapterId;
  return (all.find((c) => !c.done) ?? all[0])?.id ?? null;
}
