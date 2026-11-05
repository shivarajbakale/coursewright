/**
 * Pure helpers for the Notes screen: the flat list the API returns turned into
 * the nested tree kit's `PageTree` draws, and the icon/cover codecs between the
 * API's plain strings and kit's richer values.
 */
import type { PageCoverValue, PageIconValue, TreePage } from '@shivarajbakale/ui';
import type { NoteSummary } from '@/api/types';

/** The flat list as siblings sorted by position, per parent. */
export function childrenByParent(notes: NoteSummary[]): Map<string | null, NoteSummary[]> {
  const byParent = new Map<string | null, NoteSummary[]>();
  const ids = new Set(notes.map((n) => n.id));
  for (const n of notes) {
    // A page whose parent is gone shows at the top level rather than vanishing.
    const parent = n.parentId && ids.has(n.parentId) ? n.parentId : null;
    const list = byParent.get(parent) ?? [];
    list.push(n);
    byParent.set(parent, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  }
  return byParent;
}

export function buildTree(notes: NoteSummary[]): TreePage[] {
  const byParent = childrenByParent(notes);
  const seen = new Set<string>();
  const walk = (parent: string | null): TreePage[] =>
    (byParent.get(parent) ?? [])
      .filter((n) => !seen.has(n.id) && seen.add(n.id))
      .map((n) => {
        const children = walk(n.id);
        return {
          id: n.id,
          title: n.title,
          icon: parseIcon(n.icon),
          ...(children.length ? { children } : {}),
        };
      });
  return walk(null);
}

/** The pages from the top level down to `id` (inclusive). */
export function ancestry(notes: NoteSummary[], id: string): NoteSummary[] {
  const byId = new Map(notes.map((n) => [n.id, n]));
  const path: NoteSummary[] = [];
  let cur = byId.get(id);
  while (cur && path.length < 50) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return path;
}

/** `id` and every page under it. */
export function descendants(notes: NoteSummary[], id: string): Set<string> {
  const byParent = childrenByParent(notes);
  const out = new Set<string>([id]);
  const stack = [id];
  while (stack.length) {
    for (const c of byParent.get(stack.pop()!) ?? []) {
      if (!out.has(c.id)) {
        out.add(c.id);
        stack.push(c.id);
      }
    }
  }
  return out;
}

// ── icon: an emoji string, or a JSON-encoded PageIconValue ──────────────────
export function parseIcon(icon: string | null | undefined): PageIconValue | string | null {
  if (!icon) return null;
  if (icon.startsWith('{')) {
    try {
      return JSON.parse(icon) as PageIconValue;
    } catch {
      return null;
    }
  }
  return icon;
}

export function serializeIcon(icon: PageIconValue | null): string {
  if (!icon) return '';
  return icon.type === 'emoji' ? icon.emoji : JSON.stringify(icon);
}

// ── cover: a JSON-encoded PageCoverValue, or a bare image URL ───────────────
export function parseCover(cover: string | null | undefined): PageCoverValue | null {
  if (!cover) return null;
  if (cover.startsWith('{')) {
    try {
      return JSON.parse(cover) as PageCoverValue;
    } catch {
      return null;
    }
  }
  return { type: 'url', url: cover };
}

export function serializeCover(cover: PageCoverValue | null): string | null {
  return cover ? JSON.stringify(cover) : null;
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

/** "5 minutes ago", "yesterday". */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return 'just now';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

const FAVOURITES_KEY = 'coursewright.notes.favourites';

export function readFavourites(): string[] {
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function writeFavourites(ids: string[]): void {
  try {
    localStorage.setItem(FAVOURITES_KEY, JSON.stringify(ids));
  } catch {
    /* private window or blocked storage: favourites last for the session */
  }
}
