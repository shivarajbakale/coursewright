import { useCallback, useEffect, useState } from 'react';

interface Options {
  /** localStorage key; the width is remembered per viewer. */
  storageKey: string;
  initial: number;
  min: number;
  max: number;
}

function read(key: string, fallback: number): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

/**
 * A pane width the person can drag, clamped to [min, max] (and to the window,
 * so a remembered width can never push the page off screen) and remembered in
 * localStorage. `dragging` lets a container switch off its width transition
 * while the pointer moves.
 */
export function useResizableWidth({ storageKey, initial, min, max }: Options) {
  const [width, setWidthState] = useState(() => read(storageKey, initial));
  const [dragging, setDragging] = useState(false);
  const clamp = useCallback(
    (w: number) => Math.round(Math.min(Math.max(w, min), Math.max(min, Math.min(max, window.innerWidth * 0.6)))),
    [min, max]
  );
  const setWidth = useCallback(
    (w: number) => {
      const next = clamp(w);
      setWidthState(next);
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        /* private window: the width still applies for this visit */
      }
    },
    [clamp, storageKey]
  );
  // A width remembered on a wider screen is clamped to this one.
  useEffect(() => {
    setWidthState((w) => clamp(w));
  }, [clamp]);
  return { width, setWidth, reset: () => setWidth(initial), dragging, setDragging, min, max };
}
