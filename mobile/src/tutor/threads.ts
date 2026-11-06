/**
 * One tutor conversation per chapter, kept on this device. The thread id goes to the agent with
 * every run, so its server-side checkpoint and these messages describe the same conversation.
 * Storage failures are silent: the worst case is a fresh conversation.
 */
import type { LooseMessage } from './transcript';
import { uid } from '../uid';

export type Thread = { threadId: string; messages: LooseMessage[]; about: Record<string, string> };

const KEY = 'cw-reader-tutor';
const KEEP = 60;

function all(): Record<string, Thread> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Record<string, Thread>;
  } catch {
    return {};
  }
}

export function loadThread(chapterId: string): Thread {
  const saved = all()[chapterId];
  if (saved && typeof saved.threadId === 'string' && Array.isArray(saved.messages)) return { ...saved, about: saved.about ?? {} };
  return { threadId: `reader-${chapterId}-${uid().slice(0, 8)}`, messages: [], about: {} };
}

export function saveThread(chapterId: string, thread: Thread) {
  try {
    const kept = thread.messages.slice(-KEEP);
    const ids = new Set(kept.map((m) => m.id));
    const about = Object.fromEntries(Object.entries(thread.about).filter(([id]) => ids.has(id)));
    const next = all();
    next[chapterId] = { threadId: thread.threadId, messages: kept, about };
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage unavailable or full; the conversation lasts for this visit only
  }
}
