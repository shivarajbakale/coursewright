/**
 * The reader's router: four routes over the History API, under the /m/ base.
 *
 * The reader has no nested layouts, so a parsed route plus `navigate`/`back` is all it needs, and
 * the back button and deep links work because every screen is a real URL (nginx serves
 * /m/index.html for any path under /m/).
 */
import { useSyncExternalStore } from 'react';

export const BASE = '/m';

export type Route =
  | { name: 'library' }
  | { name: 'course'; courseId: string }
  | { name: 'chapter'; courseId: string; chapterId: string }
  | { name: 'settings' }
  | { name: 'missing'; path: string };

export function parse(pathname: string): Route {
  const path = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return { name: 'library' };
  if (parts.length === 1 && parts[0] === 'settings') return { name: 'settings' };
  if (parts[0] === 'courses' && parts.length === 2) return { name: 'course', courseId: parts[1] };
  if (parts[0] === 'courses' && parts[2] === 'chapters' && parts.length === 4) {
    return { name: 'chapter', courseId: parts[1], chapterId: parts[3] };
  }
  return { name: 'missing', path };
}

export function href(route: Exclude<Route, { name: 'missing' }>): string {
  switch (route.name) {
    case 'library':
      return `${BASE}/`;
    case 'settings':
      return `${BASE}/settings`;
    case 'course':
      return `${BASE}/courses/${encodeURIComponent(route.courseId)}`;
    case 'chapter':
      return `${BASE}/courses/${encodeURIComponent(route.courseId)}/chapters/${encodeURIComponent(route.chapterId)}`;
  }
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

/** How many entries this app has pushed, so Back never leaves the reader. */
let depth = 0;

export function navigate(to: string, { replace = false } = {}) {
  if (to === window.location.pathname) return;
  if (replace) window.history.replaceState(null, '', to);
  else {
    window.history.pushState(null, '', to);
    depth += 1;
  }
  window.scrollTo(0, 0);
  emit();
}

/** Go back inside the reader, or to `fallback` when this screen was opened directly. */
export function back(fallback: string) {
  if (depth > 0) {
    depth -= 1;
    window.history.back();
  } else navigate(fallback, { replace: true });
}

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, () => window.location.pathname);
  return parse(path);
}
