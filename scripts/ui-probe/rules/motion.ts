import type { Violation } from '../types';

/**
 * Module M — motion, measured by watching the pixels change.
 *
 * These rules do not take a `Snapshot`. A snapshot is a still frame of geometry
 * and computed style, and every question worth asking about motion is a
 * question about *time*: is it still moving, did it finish, what is it moving,
 * and — the one that catches the most — is it moving at all.
 *
 * **The first version of this module was built on `document.getAnimations()`
 * and measured nothing.** It reported the Mantine skeleton's CSS shimmer and
 * not one of the app's own entrances, because Framer animates transform and
 * opacity by writing inline styles from its own rAF loop rather than through
 * the Web Animations API. Every rule passed, on a page that was visibly
 * animating, with reduced motion deliberately ignored. The lesson is in the
 * evidence: a gate whose green light survives the defect it exists to catch is
 * worse than no gate, because it is also a claim.
 *
 * So Module M samples. `collectMotion` takes the same measurement — every
 * `[data-motion]` element's opacity, transform and box — at two moments one
 * animation frame apart, and the rules read the difference. That works whatever
 * drives the animation: Framer, a CSS transition, a `@keyframes` rule, or
 * something nobody has thought of yet. `getAnimations()` is still collected,
 * because it is the only way to see an animation that loops forever, and a CSS
 * animation is a real thing an app can ship.
 */

/** One animation the browser is running through the Web Animations API. */
export interface AuditedAnimation {
  /** `<div data-motion="reveal">`-ish, enough to find it by eye. */
  target: string;
  /** Effect duration in ms. */
  duration: number;
  /** Iteration count; `-1` stands in for `Infinity` so the audit serializes. */
  iterations: number;
  /** Every property named across the keyframes, camelCase as the DOM gives it. */
  properties: string[];
}

/** One element that declared motion, as it looked at one instant. */
export interface AuditedElement {
  /**
   * Identity of the DOM node, stable while it stays mounted and never reused.
   * M5 is the reason it exists; see `motion-audit.ts`.
   */
  uid: number;
  target: string;
  /** The `data-motion` value: `reveal`, `stagger-item`, `route`, `row`, … */
  kind: string;
  opacity: number;
  /** The computed transform, or `'none'`. */
  transform: string;
  visibility: string;
  width: number;
  height: number;
  /**
   * A cheap fingerprint of what is inside the element — child count and text
   * length.
   *
   * M3 needs it to tell the two reasons a box can change size apart. One is the
   * defect: an animation is animating `height`, and the browser runs layout
   * every frame. The other is ordinary: React committed between the samples and
   * the element now holds a table instead of eight skeleton rows. Without this
   * the rule failed Inbox, Team and Billing for loading their data.
   */
  contentKey: string;
}

export interface MotionAudit {
  label: string;
  /** True when the audit was taken with `prefers-reduced-motion: reduce`. */
  reducedMotion: boolean;
  /**
   * True when the app had stopped moving before this audit was taken.
   *
   * M2 is the only rule that needs it, and it needs it badly: "everything
   * arrived" is a statement about the end, and asking it of an audit taken
   * mid-entrance fails every animation in the app for doing its job. The first
   * version of this module asked exactly that and reported eighteen failures on
   * a page that was working correctly.
   */
  settled: boolean;
  /**
   * Samples in the order they were taken. Two or more: the rules compare the
   * first pair to see what moved, and read the last one as the end state.
   */
  frames: AuditedElement[][];
  animations: AuditedAnimation[];
}

/**
 * Animations the app is allowed to run forever.
 *
 * A skeleton's shimmer and a spinner's rotation are *state*, not decoration:
 * they say "still loading", and a loading state that stops moving reads as a
 * hung page. WCAG 2.3.3's own exception is for motion essential to the
 * information conveyed, and "the data has not arrived" is information.
 */
const LOADING_INDICATOR = /skeleton|loader|spinner|progress/i;

/** The tolerance on "arrived": a composited fade can land on 0.9999999. */
const OPAQUE = 0.99;

/** Transforms that mean "nothing is displaced". */
const IDENTITY =
  /^(none|matrix\(1, ?0, ?0, ?1, ?0, ?0\)|matrix3d\(1, ?0, ?0, ?0, ?0, ?1, ?0, ?0, ?0, ?0, ?1, ?0, ?0, ?0, ?0, ?1\))$/;

/** Sub-pixel box changes are layout noise, not an animation. */
const BOX_EPSILON = 0.5;

const first = (audit: MotionAudit) => audit.frames[0] ?? [];
const last = (audit: MotionAudit) => audit.frames[audit.frames.length - 1] ?? [];

/** An element is where the layout put it: fully opaque, undisplaced. */
function arrived(el: AuditedElement): boolean {
  return el.opacity >= OPAQUE && IDENTITY.test(el.transform);
}

/**
 * Did this element *animate* between two samples?
 *
 * Opacity and transform only. The box is deliberately not part of this: an
 * element grows when its data arrives, and calling that "still animating" made
 * M1 fail three pages for loading. What the box is good for is M3, which asks a
 * narrower question and guards it with `contentKey`.
 */
function moved(a: AuditedElement, b: AuditedElement): boolean {
  return Math.abs(a.opacity - b.opacity) > 0.01 || a.transform !== b.transform;
}

/**
 * Walk the same element across two samples.
 *
 * Paired by index: both samples come from one `querySelectorAll` on one mounted
 * tree a frame apart, so the order is the document order and it is stable. A
 * length change means React committed between the samples — a row arrived, a
 * skeleton left — and there is nothing to compare, so the pass is skipped
 * rather than guessed at.
 */
function pairs(a: AuditedElement[], b: AuditedElement[]): [AuditedElement, AuditedElement][] {
  if (a.length !== b.length) return [];
  return a.map((el, i) => [el, b[i]] as [AuditedElement, AuditedElement]);
}

/**
 * M1 — with reduced motion set, nothing animates.
 *
 * WCAG 2.3.3. The user set this at the OS level, which means they told every
 * app on the machine; this one has no standing to decide its own animation is
 * the tasteful exception.
 *
 * Two ways to fail, and the app has to survive both. An element may not *move*
 * between the two early samples — that is an animation in flight, whatever
 * started it. And it must already have *arrived* in the first sample, because
 * an entrance that starts hidden and snaps a frame later is still a flash of
 * blank page, which is exactly the symptom a vestibular user turned the setting
 * on to avoid.
 */
export function M1(audit: MotionAudit): Violation[] {
  if (!audit.reducedMotion) return [];
  const out: Violation[] = [];

  for (const [before, after] of pairs(first(audit), last(audit))) {
    if (moved(before, after)) {
      out.push({
        rule: 'M1',
        message: `${before.target} is still animating with prefers-reduced-motion: reduce set — it must be at its end state on the first frame`,
        nodeId: null,
        selectorHint: before.target,
        detail: {
          from: `opacity ${before.opacity.toFixed(2)} ${before.transform}`,
          to: `opacity ${after.opacity.toFixed(2)} ${after.transform}`,
        },
      });
    }
  }

  for (const el of first(audit)) {
    if (el.visibility === 'hidden' || arrived(el)) continue;
    out.push({
      rule: 'M1',
      message: `${el.target} starts hidden with prefers-reduced-motion: reduce set — a snap from an invisible first frame is still a flash`,
      nodeId: null,
      selectorHint: el.target,
      detail: { opacity: el.opacity, transform: el.transform, kind: el.kind },
    });
  }

  for (const a of audit.animations) {
    if (a.duration <= 0 || LOADING_INDICATOR.test(a.target)) continue;
    out.push({
      rule: 'M1',
      message: `${a.target} runs a ${Math.round(a.duration)}ms animation with prefers-reduced-motion: reduce set`,
      nodeId: null,
      selectorHint: a.target,
      detail: { durationMs: Math.round(a.duration), properties: a.properties.join(', ') },
    });
  }

  return out;
}

/**
 * M2 — an element that declared motion finished visible.
 *
 * The defect this exists for: an entrance variant sets `opacity: 0`, the
 * animation never runs — a missing `animate`, a variant name that does not
 * match, an `AnimatePresence` that unmounted the wrong key — and the content
 * sits in the DOM at zero opacity. Every other gate passes. The component
 * renders, `getByText` finds it, the archetype rules count it as a section, the
 * axe run reads its label. Only a person looking at the screen, or this rule,
 * sees that the page is blank.
 *
 * It runs in both motion modes, and only on a settled audit, and it is the
 * reason `lib/motion.ts` collapses to a zero *duration* rather than removing
 * the animation: the element still travels
 * to `visible`, just instantly.
 */
export function M2(audit: MotionAudit): Violation[] {
  if (!audit.settled) return [];
  return last(audit)
    .filter((el) => el.visibility !== 'hidden')
    .flatMap((el) => {
      const out: Violation[] = [];
      if (el.opacity < OPAQUE) {
        out.push({
          rule: 'M2',
          message: `${el.target} settled at opacity ${el.opacity.toFixed(2)} — an entrance that did not finish leaves its content in the DOM and off the screen`,
          nodeId: null,
          selectorHint: el.target,
          detail: { opacity: el.opacity, kind: el.kind },
        });
      }
      if (!IDENTITY.test(el.transform)) {
        out.push({
          rule: 'M2',
          message: `${el.target} settled with transform ${el.transform} — it stopped short of where the layout put it`,
          nodeId: null,
          selectorHint: el.target,
          detail: { transform: el.transform, kind: el.kind },
        });
      }
      return out;
    });
}

/**
 * M3 — motion is composited, and it is finite.
 *
 * Two failures with one cause: an animation asking for something the compositor
 * cannot give. A box that changes size mid-animation is running layout on every
 * frame, which is the difference between a 60fps entrance and a visibly
 * juddering one on a laptop that has dropped to its power-saving clock. A loop
 * with no end on something that is not a loading indicator is decoration, and
 * it never stops costing frames.
 *
 * The box comparison is why `AuditedElement` carries width and height at all.
 * It catches the layout animation whatever wrote it — a Framer `animate={{
 * height }}`, a CSS transition on `width`, a `layout` prop resizing a panel.
 */
export function M3(audit: MotionAudit): Violation[] {
  const out: Violation[] = [];

  for (const [before, after] of pairs(first(audit), last(audit))) {
    // A box that changed because its *contents* changed is React committing,
    // not an animation running layout. Only a stable subtree can be judged.
    if (before.contentKey !== after.contentKey) continue;

    const dw = Math.abs(before.width - after.width);
    const dh = Math.abs(before.height - after.height);
    if (dw > BOX_EPSILON || dh > BOX_EPSILON) {
      out.push({
        rule: 'M3',
        message: `${before.target} changes size while animating (${Math.round(dw)}×${Math.round(dh)}px) — animating a box runs layout every frame; animate transform instead`,
        nodeId: null,
        selectorHint: before.target,
        detail: { deltaWidth: Math.round(dw), deltaHeight: Math.round(dh), kind: before.kind },
      });
    }
  }

  for (const a of audit.animations) {
    if (a.iterations !== -1 || LOADING_INDICATOR.test(a.target)) continue;
    out.push({
      rule: 'M3',
      message: `${a.target} loops forever and is not a loading indicator — a permanent animation is decoration, and it never stops costing frames`,
      nodeId: null,
      selectorHint: a.target,
      detail: { iterations: 'infinite', properties: a.properties.join(', ') },
    });
  }

  return out;
}

/**
 * M4 — the app actually moves.
 *
 * The anti-vacuity rule, and the one this module would be dishonest without.
 * M1, M2 and M3 are all satisfied by an app with no motion in it whatsoever:
 * nothing animates under reduced motion, nothing settles invisible, nothing
 * runs layout. A green Module M would then be a claim about choreography that
 * had been silently deleted.
 *
 * It is a run-level rule rather than a per-audit one, like A5: motion is spread
 * over time, and the question "did anything move" can only be asked of a whole
 * sequence of samples. One audit is one moment, and an entrance is allowed to
 * be over by the time a later moment arrives.
 *
 * **This rule failed on the day it was written**, which is the reason it is
 * here. `AnimatePresence initial={false}` in the route wrapper (since deleted;
 * see `docs/principles/motion.md`) looked like
 * "do not animate the first page load, only the changes" and did much more:
 * `AnimatePresence` publishes its `initial` on a context that every `motion`
 * component below it reads, so one prop on the shell suppressed the entrance of
 * every tile, panel and row on the first page the app ever showed. Eight
 * elements declared motion; all eight were already at their end state. No other
 * gate in this repo could have seen that — the page renders, the content is
 * there, the geometry is final.
 */
export function M4(audits: MotionAudit[]): Violation[] {
  const live = audits.filter((a) => !a.reducedMotion);
  if (live.length === 0) return [];

  const label = live[0].label;
  const declared = Math.max(...live.map((a) => first(a).length));

  if (declared === 0) {
    return [
      {
        rule: 'M4',
        message: `${label} declares no [data-motion] elements — there is nothing here for Module M to measure`,
        nodeId: null,
        selectorHint: label,
        detail: { elements: 0 },
      },
    ];
  }

  const inFlight = live.some(
    (audit) =>
      first(audit).some((el) => !arrived(el)) ||
      pairs(first(audit), last(audit)).some(([before, after]) => moved(before, after))
  );

  if (inFlight) return [];

  return [
    {
      rule: 'M4',
      message: `nothing moved in ${label}: ${declared} element(s) declare motion and every sample caught all of them already at their end state — the choreography is not running`,
      nodeId: null,
      selectorHint: label,
      detail: { elements: declared, audits: live.length },
    },
  ];
}

/**
 * M5 — nothing that has arrived may leave again while it stays mounted.
 *
 * A motion audit is a sequence of samples, and this is the only rule that reads
 * more than its ends. An element that reaches full opacity and then drops back
 * is not animating; it is *replaying*, and a replay is what a reader calls a
 * flicker.
 *
 * It exists because of a defect the other four could not see. `RouteTransition`
 * wrapped the shell's outlet in `<AnimatePresence mode="wait">`, which holds
 * the exiting child's React element and keeps rendering it during the exit —
 * and that child is `<Outlet />`, a live component that renders whatever the
 * router points at *now*. So on every navigation the destination page rendered
 * at full opacity, faded itself out to zero, and faded back in:
 *
 * ```
 * 2514ms  h1=Customers  routeOpacity=100
 * 2618ms  h1=Customers  routeOpacity=0
 * 2867ms  h1=Customers  routeOpacity=100
 * ```
 *
 * M1 was satisfied (reduced motion still snapped), M2 was satisfied (it
 * settled at 1), M3 was satisfied (nothing resized), M4 was satisfied
 * (something certainly moved). Every one of them reads a *mount*; this one
 * reads a transition.
 *
 * The rule is deliberately narrow: it only fires for an element that was
 * already at rest. An entrance that has not finished is allowed to be at any
 * opacity, and an element that unmounts drops out of the tracking rather than
 * counting as a fade.
 */
export function M5(audit: MotionAudit): Violation[] {
  if (audit.frames.length < 2) return [];
  const out: Violation[] = [];

  /*
    Identity, not index, and not description either.

    The first version of this rule paired elements by position and skipped any
    audit whose element count changed between samples — which is every
    navigation, so it disabled itself in precisely the situation it was written
    for. The second keyed on the element's description, and could not tell a
    node fading out from a *different* node mounting in its place: a keyed route
    change and the AnimatePresence defect serialize identically that way, and
    they are opposites. `uid` is the node itself.
  */
  /** Nodes seen fully opaque, and the sample it happened at. */
  const arrivedAt = new Map<number, number>();

  audit.frames.forEach((frame, index) => {
    const present = new Set(frame.map((el) => el.uid));
    // A node that left the tree unmounted; it did not fade.
    for (const uid of arrivedAt.keys()) {
      if (!present.has(uid)) arrivedAt.delete(uid);
    }

    for (const el of frame) {
      if (el.visibility === 'hidden') continue;

      if (!arrivedAt.has(el.uid)) {
        if (el.opacity >= OPAQUE) arrivedAt.set(el.uid, index);
        continue;
      }
      if (el.opacity >= OPAQUE) continue;

      out.push({
        rule: 'M5',
        message: `${el.target} was fully visible and faded back to ${el.opacity.toFixed(2)} without unmounting — a replay reads as a flicker`,
        nodeId: null,
        selectorHint: el.target,
        detail: {
          arrivedAtSample: arrivedAt.get(el.uid) as number,
          regressedAtSample: index,
          opacity: el.opacity,
        },
      });
      // One flicker is one violation, not one per frame.
      arrivedAt.delete(el.uid);
    }
  });

  return out;
}

/** Every rule that is a pure function of one audit. M4 is cross-audit. */
export function runMotionRules(audit: MotionAudit): Violation[] {
  return [...M1(audit), ...M2(audit), ...M3(audit), ...M5(audit)];
}
