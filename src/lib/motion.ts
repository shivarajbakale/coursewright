import { useSyncExternalStore } from 'react';
import type { Transition, Variants } from 'motion/react';

/**
 * The motion scale.
 *
 * Motion is a token layer like colour and spacing, and for the same reason: an
 * ad-hoc `0.35` somewhere in a component is a value nobody can retune, and the
 * app ends up with fourteen slightly different ideas of how fast it moves.
 * Everything animated in this app reads a duration and an easing from here, and
 * `ui-lint`'s `raw-motion-duration` / `raw-motion-easing` rules fail the build
 * on a literal.
 *
 * Framer counts in **seconds**; the CSS scale in
 * `docs/principles/motion.md` counts in milliseconds. Same numbers, and the
 * names are the same on both sides so a reader moving between a CSS
 * `transition-duration` and a `transitions.base` is looking at one scale.
 */
export const durations = {
  /** 0ms — the reduced-motion answer, and the "no animation" answer. */
  instant: 0,
  /** 100ms — a toggle, a focus ring, a hover tint. */
  fast: 0.1,
  /** 200ms — the default UI transition. */
  base: 0.2,
  /** 300ms — page-level: a route change, a modal, a section reveal. */
  slow: 0.3,
  /** 500ms — emphasis only. A number counting up to its value. */
  emphasis: 0.5,
} as const;

/**
 * Seconds to milliseconds, for the components that count the other way.
 *
 * Framer takes seconds; Mantine's `RollingNumber` takes an `animationDuration`
 * in milliseconds. One scale, two units — `ms(durations.emphasis)` keeps the
 * conversion at the call site instead of a second set of numbers somewhere.
 */
export const ms = (seconds: number) => Math.round(seconds * 1000);

/**
 * Easings, as cubic-bézier control points.
 *
 * `out` decelerates into place and is what entrances use; `in` accelerates away
 * and is what exits use. Getting those backwards is the single most common way
 * motion reads as sluggish — an entrance that starts slow makes the app feel
 * like it is thinking.
 *
 * `linear` is deliberately absent. Nothing in a UI moves at a constant speed
 * except a progress bar, and Mantine draws that one.
 */
export const easings = {
  out: [0.16, 1, 0.3, 1],
  in: [0.7, 0, 0.84, 0],
  inOut: [0.65, 0, 0.35, 1],
} as const;

/** A spring, for the one thing that should feel physical: the nav indicator. */
export const spring: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};

export const transitions = {
  fast: { duration: durations.fast, ease: easings.out },
  base: { duration: durations.base, ease: easings.out },
  slow: { duration: durations.slow, ease: easings.out },
  emphasis: { duration: durations.emphasis, ease: easings.out },
  exit: { duration: durations.fast, ease: easings.in },
} as const satisfies Record<string, Transition>;

/**
 * How far an entering element travels.
 *
 * Small on purpose. A 24px slide is a flourish the second time you see it and
 * an obstruction the twentieth; 8px reads as the content settling into place,
 * which is the only thing an entrance is for.
 */
const TRAVEL = 8;

/**
 * The shared variant vocabulary.
 *
 * Three names, because three is what the app actually needs: something appears
 * (`fade`), something appears from below (`fadeUp`), or a list of things
 * appears one after another (`stagger` on the parent, `fadeUp` on each child).
 *
 * Every variant animates `opacity` and `transform` only. Animating `width`,
 * `height`, `top` or `left` runs layout on every frame, which is what makes an
 * animation drop frames on a laptop with the battery saver on — `ui-lint`'s
 * `layout-animation` rule fails those, and the probe's M3 catches one that
 * reaches the browser another way.
 */
export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.base },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: TRAVEL },
  visible: { opacity: 1, y: 0, transition: transitions.slow },
};

/**
 * A container whose children arrive in sequence.
 *
 * `staggerChildren` is 40ms, not the 100ms that reads well in a demo video: a
 * six-tile dashboard at 100ms takes 600ms to finish arriving, and the user is
 * already reading the first tile while the last one is still moving. The whole
 * sequence has to land inside the ~300ms the eye reads as "the page loaded".
 */
export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function subscribeToReducedMotion(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

function readReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Whether this user wants motion at all.
 *
 * `prefers-reduced-motion: reduce` is an OS setting rather than an app one — a
 * user who set it has told every app on their machine, and WCAG 2.3.3 says this
 * one has to listen.
 *
 * `useSyncExternalStore` rather than Framer's own `useReducedMotion`, and the
 * difference is not stylistic. Framer's hook resolves the query through a
 * module-level value that is wrong on the **first render** and corrects itself
 * afterwards, so every entrance in the app started from its hidden state and
 * only then discovered it should not have. Probe rule M1 caught it: with the
 * media feature emulated, five elements still reported `starts hidden`, which
 * is precisely the flash of blank page the setting exists to prevent.
 * `useSyncExternalStore` reads the store during render, so the first frame is
 * already right.
 *
 * The answer here is also stronger than Framer's `reducedMotion="user"`, which
 * suppresses transform and layout animation but still fades. That is a
 * defensible reading of the spec and the wrong one for a user whose reason for
 * setting it is vestibular: a 300ms fade on every route change is still 300ms
 * of the screen not being readable. Under this hook the app **snaps** — the end
 * state, on the first frame, every time.
 */
export function useMotionEnabled(): boolean {
  // The third argument is the server snapshot: assume no preference, so the
  // first client frame matches the markup rather than replacing it.
  return !useSyncExternalStore(subscribeToReducedMotion, readReducedMotion, () => false);
}

/**
 * The transition to actually pass to a `motion` component.
 *
 * Returns the token when motion is on and a zero-duration transition when it is
 * not. Note that it is zero-*duration* rather than no transition at all: the
 * element still animates to its `visible` state, so a variant that starts at
 * `opacity: 0` finishes at `opacity: 1` on the first frame instead of staying
 * invisible forever. That failure — the entrance that never ran, leaving the
 * content in the DOM and unreadable — is what probe rule M2 exists to catch.
 */
export function useTransition(key: keyof typeof transitions = 'base'): Transition {
  return useMotionEnabled() ? transitions[key] : { duration: durations.instant };
}
