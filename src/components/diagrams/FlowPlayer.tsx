import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Skeleton } from '@mantine/core';

interface FlowmoviePlayer {
  seek(ms: number): void;
  destroy?: () => void;
}
interface FlowmovieGlobal {
  renderFlowmovie(el: HTMLElement, source: string, opts?: { camera?: 'auto' | 'fit' }): FlowmoviePlayer;
}
declare global {
  interface Window {
    Flowmovie?: FlowmovieGlobal;
  }
}

let loading: Promise<FlowmovieGlobal> | null = null;

/** Loads the vendored Flowmovie player (MIT, ~165 KB) once, on first use. */
function loadFlowmovie(): Promise<FlowmovieGlobal> {
  if (window.Flowmovie) return Promise.resolve(window.Flowmovie);
  loading ??= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = '/vendor/flowmovie/flowmovie.css';
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = '/vendor/flowmovie/flowmovie.js';
    script.onload = () => (window.Flowmovie ? resolve(window.Flowmovie) : reject(new Error('Flowmovie missing')));
    script.onerror = () => reject(new Error('Could not load the Flowmovie player'));
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Plays a Flowmovie (`.flow` text): an animated, scrubbable movie of a process,
 * one step at a time with captions. The agent service checks every movie
 * before saving it, so a source that reaches here compiles.
 */
export function FlowPlayer({ source }: { source: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    let player: FlowmoviePlayer | null = null;
    let cancelled = false;
    loadFlowmovie()
      .then((fm) => {
        if (cancelled || !el) return;
        el.innerHTML = '';
        player = fm.renderFlowmovie(el, source, { camera: 'auto' });
        setState('ready');
      })
      .catch((e: Error) => {
        setError(e.message);
        setState('error');
      });
    return () => {
      cancelled = true;
      player?.destroy?.();
      if (el) el.innerHTML = '';
    };
  }, [source]);

  return (
    <Box>
      {state === 'loading' && <Skeleton h={320} radius="md" />}
      {state === 'error' && (
        <Alert color="red" variant="light" title="This movie can't play">
          {error}
        </Alert>
      )}
      <Box ref={ref} data-flowmovie />
    </Box>
  );
}
