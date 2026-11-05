import { useEffect, useRef, useState } from 'react';
import type { NotePatch } from '@/api/services/coursewrightService';
import { useUpdateNote } from '@/hooks/useCoursewright';

const SAVE_DELAY = 800;

export type SaveState = 'saved' | 'saving' | 'error';

/**
 * Saves patches after a pause in typing. Each field keeps its own latest value,
 * so a title edit and a body edit inside one pause go out as one PATCH. Leaving
 * the page (unmount) sends whatever is still waiting.
 */
export function useDebouncedSave(id: string) {
  const update = useUpdateNote();
  const mutate = useRef(update.mutate);
  mutate.current = update.mutate;
  const pending = useRef<NotePatch>({});
  const timer = useRef<number | null>(null);
  const inFlight = useRef(0);
  const [state, setState] = useState<SaveState>('saved');

  const flush = useRef(() => {});
  flush.current = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    inFlight.current += 1;
    mutate.current(
      { id, patch },
      {
        onSuccess: () => {
          inFlight.current -= 1;
          if (!inFlight.current && !timer.current) setState('saved');
        },
        onError: () => {
          inFlight.current -= 1;
          setState('error');
        },
      }
    );
  };

  const schedule = (patch: NotePatch, immediate = false) => {
    pending.current = { ...pending.current, ...patch };
    setState('saving');
    if (timer.current) window.clearTimeout(timer.current);
    if (immediate) flush.current();
    else timer.current = window.setTimeout(() => flush.current(), SAVE_DELAY);
  };

  useEffect(() => () => flush.current(), []);

  return { schedule, state, flush: () => flush.current() };
}
