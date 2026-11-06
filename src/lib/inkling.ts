/**
 * Inkling explainers, shared by the desktop app and the phone/iPad reader.
 *
 * A lesson's explainer is an ```inkling fence in its markdown: a few lines of text that Inkling (the
 * owner's library, vendored in vendor/inkling from ~/Projects/inkling) draws by hand and animates step by
 * step. This module loads the library on first use (about 36 KB gzipped, only on chapters that have one),
 * draws into a plain DOM node, and wraps Inkling's Player in a small controller both apps put their own
 * controls on. The paper comes from the reading theme, never from the source.
 */
import type { Diagram, Player as PlayerType } from '../../vendor/inkling/inkling.js';

type InklingModule = typeof import('../../vendor/inkling/inkling.js');

let loading: Promise<InklingModule> | null = null;

export function loadInkling(): Promise<InklingModule> {
  loading ??= import('../../vendor/inkling/inkling.js').catch((e: unknown) => {
    loading = null; // let a retry fetch it afresh
    throw e;
  });
  return loading;
}

export type Paper = 'chalkboard' | 'notebook' | 'napkin';

/** The paper for a reading theme: chalkboard in the dark, notebook in the light, napkin on sepia. */
export function paperFor(theme: 'dark' | 'light' | 'sepia'): Paper {
  return theme === 'dark' ? 'chalkboard' : theme === 'sepia' ? 'napkin' : 'notebook';
}

const TITLE = /^\s*title\s+"((?:[^"\\]|\\.)*)"/m;

/** The explainer's title line, for the loading box, the error note and the label. */
export function inklingTitle(source: string): string {
  return TITLE.exec(source)?.[1].replace(/\\"/g, '"') ?? '';
}

export interface ExplainerState {
  /** The step being drawn, or the last one drawn. */
  step: number;
  steps: { caption: string }[];
  playing: boolean;
  /** The drawing is complete. */
  done: boolean;
}

export interface Explainer {
  play(): void;
  pause(): void;
  next(): void;
  prev(): void;
  destroy(): void;
}

/** How long a drawing waits for its fonts. Tests set it to 0 (jsdom never loads a stylesheet). */
export const fontWait = { ms: 2500 };

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Draws `source` into a new child of `host` and returns a controller; `destroy` removes that child. The drawing starts
 * finished; it plays from the start once, the first time half of it scrolls into view, unless the reader
 * asked for reduced motion. Throws with the first error message when the source has a mistake.
 */
export async function mountExplainer(
  host: HTMLElement,
  source: string,
  paper: Paper,
  onChange: (s: ExplainerState) => void,
): Promise<Explainer> {
  const ink = await loadInkling();
  const error = ink.parse(source).diagnostics.find((d) => d.severity === 'error');
  if (error) throw new Error(error.message);

  // Each drawing gets its own stage and removes only that, so a mount cancelled mid-way (a re-render, React
  // StrictMode) can never wipe the one that replaced it.
  const stage = document.createElement('div');
  stage.className = 'cw-inkling';
  // SVG <text> has no box of its own to clip it, so the UI probe's text-cut-off rules don't apply inside.
  stage.dataset.probeIgnore = 'T1 T2';
  host.appendChild(stage);
  // The handwriting fonts come from Google Fonts. Wait for them a moment (text is measured with them), but
  // never forever: a blocked or slow font still gets a drawing, in the fallback hand.
  await Promise.race([ink.loadHands(), new Promise((r) => setTimeout(r, fontWait.ms))]);
  const diagram: Diagram = ink.mount(stage, source, { paper, ...(paper === 'chalkboard' ? { pen: 'chalk' } : {}) });
  const svg = diagram.svg;
  // Fit the column, and never taller than most of the screen: a tall sequence would otherwise push its
  // own controls out of view. Scaled from the drawing's own size, so it stays crisp and never widens the page.
  const [w, h] = [Number(svg.getAttribute('width')) || 600, Number(svg.getAttribute('height')) || 400];
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.style.display = 'block';
  svg.style.width = `min(100%, ${w}px, calc(70vh * ${(w / h).toFixed(4)}))`;
  svg.style.height = 'auto';
  svg.style.aspectRatio = `${w} / ${h}`;
  svg.style.margin = '0 auto';
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', [inklingTitle(source), ...diagram.steps.map((s) => s.caption)].filter(Boolean).join('. '));

  const steps = diagram.steps.map((s) => ({ caption: s.caption ?? '' }));
  let last = '';
  const report = (p: PlayerType) => {
    const done = p.t >= diagram.duration - 0.01;
    const state: ExplainerState = { step: p.stepIndex, steps, playing: p.playing, done };
    const key = `${state.step}|${state.playing}|${state.done}`;
    if (key !== last) {
      last = key;
      onChange(state);
    }
  };
  const player = new ink.Player(diagram, report);
  player.finish();
  report(player);

  let observer: IntersectionObserver | null = null;
  if (!reducedMotion() && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer?.disconnect();
          observer = null;
          player.play(true);
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(stage);
  }

  return {
    play: () => player.play(player.t >= diagram.duration - 0.01),
    pause: () => player.pause(),
    next: () => player.next(),
    prev: () => player.prev(),
    destroy: () => {
      observer?.disconnect();
      player.destroy();
      diagram.destroy();
      stage.remove();
    },
  };
}
