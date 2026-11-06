/**
 * Plays a Flowmovie (`.flow` text) with the vendored player the web app uses, mounted into a View's
 * DOM node (react-native-web renders real DOM). The player loads on first use only.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePalette } from '../settings';
import { font, space } from '../theme';
import { Message } from '../components/States';

type Player = { destroy?: () => void };
type Flowmovie = { renderFlowmovie(el: HTMLElement, source: string, opts?: { camera?: 'auto' | 'fit' }): Player };
/** The player's global, read without a `declare global` (the web app declares its own shape). */
const playerGlobal = () => (window as unknown as { Flowmovie?: Flowmovie }).Flowmovie;

const BASE = `${import.meta.env.BASE_URL}vendor/flowmovie`;
let loading: Promise<Flowmovie> | null = null;

function loadPlayer(): Promise<Flowmovie> {
  const ready = playerGlobal();
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<Flowmovie>((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = `${BASE}/flowmovie.css`;
    document.head.appendChild(css);
    const script = document.createElement('script');
    script.src = `${BASE}/flowmovie.js`;
    script.onload = () => {
      const fm = playerGlobal();
      if (fm) resolve(fm);
      else reject(new Error('missing player'));
    };
    script.onerror = () => reject(new Error('could not load the player'));
    document.head.appendChild(script);
  }).catch((e: Error) => {
    loading = null; // let Try again fetch it afresh
    throw e;
  });
  return loading;
}

export function FlowMovie({ source }: { source: string }) {
  const p = usePalette();
  const host = useRef<HTMLElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const el = host.current;
    let player: Player | null = null;
    let cancelled = false;
    setState('loading');
    loadPlayer()
      .then((fm) => {
        if (cancelled || !el) return;
        // The player styles its mount node (class fm-player). react-native-web rewrites a View's
        // classes on every render, so the player gets a plain child div that React never touches.
        el.innerHTML = '';
        const mount = document.createElement('div');
        el.appendChild(mount);
        player = fm.renderFlowmovie(mount, source, { camera: 'auto' });
        setState('ready');
      })
      .catch(() => !cancelled && setState('error'));
    return () => {
      cancelled = true;
      player?.destroy?.();
      if (el) el.innerHTML = '';
    };
  }, [source, attempt]);

  return (
    <View>
      {state === 'loading' ? (
        <View style={[styles.placeholder, { backgroundColor: p.raised }]}>
          <Text style={[styles.note, { color: p.muted }]}>Loading the movie…</Text>
        </View>
      ) : null}
      {state === 'error' ? <Message tone="error" title="This movie can't play right now." action="Try again" onAction={() => setAttempt((n) => n + 1)} /> : null}
      <View ref={host} style={state === 'ready' ? styles.player : styles.hidden} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { height: 320, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  note: { fontFamily: font.ui, fontSize: 14 },
  player: { width: '100%' },
  hidden: { display: 'none' },
});
