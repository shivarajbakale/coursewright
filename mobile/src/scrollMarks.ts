/**
 * Where you stopped in each chapter, on this device. Stored as a share of the chapter's height so a
 * text-size change still lands near the same paragraph. Storage failures are silent: resuming at
 * the top is the worst case.
 */
const KEY = 'cw-reader-scroll';

function readAll(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export function getMark(chapterId: string): number {
  const v = readAll()[chapterId];
  return typeof v === 'number' && v > 0 && v < 1 ? v : 0;
}

export function setMark(chapterId: string, ratio: number) {
  try {
    const all = readAll();
    all[chapterId] = Math.round(Math.min(1, Math.max(0, ratio)) * 1000) / 1000;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // storage unavailable; nothing to do
  }
}
