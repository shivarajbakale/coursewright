/**
 * What the reader did offline (chapter progress, quiz answers), kept on the device and sent in order
 * once it is online again: on the 'online' event and when the app starts. iOS has no background sync,
 * so nothing is sent while the app is closed.
 *
 * A send that fails for lack of a connection or a server error (status 0 or 5xx) stays queued; a 4xx
 * means the server will never take it (the chapter was deleted), so it is dropped.
 */
import { useSyncExternalStore } from 'react';
import { chapterService } from '@/api/services/coursewrightService';

const KEY = 'cw-reader-outbox';
const EVENT = 'cw-outbox';

export type OutboxItem =
  | { kind: 'progress'; chapterId: string; finished: boolean; at: string }
  | { kind: 'attempt'; questionId: string; chapterId: string; chosen: number; at: string };

function read(): OutboxItem[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const items = raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

let cache: OutboxItem[] | null = null;

function write(items: OutboxItem[]) {
  cache = items;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked: the queue lives for this session only.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function pending(): OutboxItem[] {
  cache ??= read();
  return cache;
}

/** Queue one action. A chapter's progress collapses to one item: once finished, it stays finished. */
type NewItem = OutboxItem extends infer T ? (T extends OutboxItem ? Omit<T, 'at'> : never) : never;

export function enqueue(item: NewItem): void {
  const at = new Date().toISOString();
  const items = pending();
  if (item.kind === 'progress') {
    const earlier = items.find((i) => i.kind === 'progress' && i.chapterId === item.chapterId) as
      | Extract<OutboxItem, { kind: 'progress' }>
      | undefined;
    const finished = item.finished || Boolean(earlier?.finished);
    write([...items.filter((i) => i !== earlier), { ...item, finished, at } as OutboxItem]);
    return;
  }
  write([...items, { ...item, at } as OutboxItem]);
}

/** A failure worth retrying later: no connection, or the server is down. */
export function isRetryable(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status;
  return status === undefined || status === 0 || status >= 500;
}

type Send = (item: OutboxItem) => Promise<unknown>;

const send: Send = (item) =>
  item.kind === 'progress' ? chapterService.progress(item.chapterId, item.finished) : chapterService.attempt(item.questionId, item.chosen);

let flushing: Promise<number> | null = null;

/** Send the queue oldest first; stops at the first retryable failure. Returns how many were sent. */
export function flush(sender: Send = send): Promise<number> {
  flushing ??= (async () => {
    let sent = 0;
    try {
      for (const item of [...pending()]) {
        try {
          await sender(item);
          sent += 1;
        } catch (e) {
          if (isRetryable(e)) break;
        }
        write(pending().filter((i) => i !== item));
      }
    } finally {
      flushing = null;
    }
    return sent;
  })();
  return flushing;
}

/** Flush now and whenever the connection comes back; `onSent` runs after a flush that sent anything. */
export function startOutbox(onSent: () => void): () => void {
  const run = () => void flush().then((n) => n > 0 && onSent());
  run();
  window.addEventListener('online', run);
  return () => window.removeEventListener('online', run);
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

export function useOutbox(): OutboxItem[] {
  return useSyncExternalStore(subscribe, pending, pending);
}

/** For tests. */
export function resetOutbox() {
  cache = null;
}
