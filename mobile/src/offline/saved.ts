/**
 * Courses kept on this device. The chapters themselves live in the service worker's 'cw-api' cache
 * (every chapter the reader opens lands there too); this module fills it for a whole course on
 * "Save for offline", measures it, removes it, and says which chapters are on the device.
 *
 * It only works when the service worker controls the page (https or localhost); without one there is
 * nothing to save into, and `canSave()` is false.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { CourseDetail } from '@/api/types';

const KEY = 'cw-reader-saved';
const EVENT = 'cw-saved';
export const API_CACHE = 'cw-api';
const API = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api';

export interface SavedCourse {
  chapterIds: string[];
  bytes: number;
  savedAt: string;
}

type Saved = Record<string, SavedCourse>;

function read(): Saved {
  try {
    return (JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Saved) ?? {};
  } catch {
    return {};
  }
}

let cache: Saved | null = null;
function all(): Saved {
  cache ??= read();
  return cache;
}

function write(next: Saved) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // keep it for this session
  }
  window.dispatchEvent(new Event(EVENT));
}

export function canSave(): boolean {
  return typeof caches !== 'undefined' && !!navigator.serviceWorker?.controller;
}

export const chapterUrl = (id: string) => `${API}/chapters/${encodeURIComponent(id)}`;
const courseUrl = (id: string) => `${API}/courses/${encodeURIComponent(id)}`;

export interface SaveProgress {
  done: number;
  total: number;
  failed: number;
}

/**
 * Fetch every chapter of the course (and the course and library) through the worker, `limit` at a
 * time, so they land in its cache. Stops early when `signal` aborts. A storage-full error stops it
 * and is thrown.
 */
export async function saveCourse(
  course: CourseDetail,
  onProgress: (p: SaveProgress) => void,
  signal?: AbortSignal,
  limit = 4,
): Promise<SaveProgress> {
  const ids = course.modules.flatMap((m) => m.chapters.map((c) => c.id));
  const p: SaveProgress = { done: 0, total: ids.length, failed: 0 };
  let bytes = 0;
  const saved: string[] = [];
  await Promise.all([fetch(courseUrl(course.id)), fetch(`${API}/courses`)].map((r) => r.catch(() => null)));
  const queue = [...ids];
  const worker = async () => {
    while (queue.length && !signal?.aborted) {
      const id = queue.shift()!;
      try {
        // The header keeps the server from treating a prefetch as opening the chapter (the Continue card).
        const res = await fetch(chapterUrl(id), { signal, headers: { 'X-CW-Prefetch': '1' } });
        if (!res.ok) throw new Error(String(res.status));
        bytes += (await res.text()).length;
        saved.push(id);
      } catch (e) {
        if ((e as Error).name === 'QuotaExceededError') throw e;
        if (signal?.aborted) return;
        p.failed += 1;
      }
      p.done += 1;
      onProgress({ ...p });
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, ids.length) }, worker));
  if (saved.length) write({ ...all(), [course.id]: { chapterIds: saved, bytes, savedAt: new Date().toISOString() } });
  return p;
}

/** Drop a saved course's chapters from the device. Progress lives on the server and is untouched. */
export async function removeCourse(courseId: string): Promise<void> {
  const entry = all()[courseId];
  if (typeof caches !== 'undefined') {
    const c = await caches.open(API_CACHE);
    await Promise.all([...(entry?.chapterIds ?? []).map((id) => c.delete(chapterUrl(id))), c.delete(courseUrl(courseId))]);
  }
  const next = { ...all() };
  delete next[courseId];
  write(next);
  window.dispatchEvent(new Event(EVENT));
}

export async function removeEverything(): Promise<void> {
  if (typeof caches !== 'undefined') await caches.delete(API_CACHE);
  write({});
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useSavedCourses(): Saved {
  return useSyncExternalStore(subscribe, all, all);
}

/** The chapter ids whose reading data is on this device (saved or opened), refreshed on save/remove. */
export function useChaptersOnDevice(): Set<string> | null {
  const [ids, setIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (typeof caches === 'undefined') return;
    let live = true;
    const load = async () => {
      const keys = await (await caches.open(API_CACHE)).keys();
      const found = new Set(keys.map((r) => /\/chapters\/([^/?]+)$/.exec(new URL(r.url).pathname)?.[1]).filter(Boolean).map((s) => decodeURIComponent(s!)));
      if (live) setIds(found);
    };
    void load();
    window.addEventListener(EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(EVENT, load);
    };
  }, []);
  return ids;
}

/** For tests. */
export function resetSaved() {
  cache = null;
}

export function formatBytes(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
