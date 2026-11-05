import type { AuditedAnimation, AuditedElement, MotionAudit } from './rules/motion';

/**
 * The live-DOM half of Module M.
 *
 * `snapshot.ts` serializes geometry; this serializes *change* in geometry. Both
 * exist so the rules stay pure functions over plain data — the same shape a
 * jsdom unit test can hand them, and the same shape a future CDP driver could
 * produce without touching a rule.
 *
 * The measurement is a sample, taken twice. That is not the obvious design:
 * `document.getAnimations()` looks like the right instrument and it is the one
 * this file used first. It does not work here. Framer animates transform and
 * opacity by writing inline styles from its own requestAnimationFrame loop, so
 * none of this app's entrances appear in that list — the first version of
 * Module M reported the Mantine skeleton's CSS shimmer, nothing else, and
 * passed every rule while the page was visibly animating with reduced motion
 * switched on.
 *
 * Sampling the rendered result is library-agnostic by construction. Whatever
 * moves the pixels — Framer, a CSS transition, a `@keyframes` rule, the View
 * Transitions API — two samples a frame apart see it.
 *
 * `getAnimations()` is still collected, for the one thing sampling cannot see:
 * an animation that loops forever looks identical to one that is mid-flight.
 */

/** `<tr data-motion="row">` — enough to find the element by eye in a report. */
function describe(target: Element): string {
  const el = target as HTMLElement;
  const kind = el.dataset?.motion;
  const id = el.id ? `#${el.id}` : '';
  const attrs = [
    kind ? `data-motion="${kind}"` : '',
    el.dataset?.panel ? `data-panel="${el.dataset.panel}"` : '',
    el.dataset?.slot ? `data-slot="${el.dataset.slot}"` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const cls =
    !attrs && el.className && typeof el.className === 'string'
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
  return `<${target.tagName.toLowerCase()}${id}${cls}${attrs ? ' ' + attrs : ''}>`;
}

/**
 * A stable id per DOM node, for the life of the page.
 *
 * M5 asks whether an element that had arrived faded back, and that question is
 * only meaningful about *the same node*. Pairing samples by position or by
 * description cannot tell an element fading out from a different element
 * mounting in its place — which is exactly what a keyed route change looks
 * like, and exactly what the defect M5 exists for looks like. The two are
 * opposites and they serialize identically without this.
 *
 * A `WeakMap`, so a node that unmounts takes its id with it.
 */
const uids = new WeakMap<Element, number>();
let nextUid = 1;

function uidOf(el: Element): number {
  let uid = uids.get(el);
  if (uid === undefined) {
    uid = nextUid++;
    uids.set(el, uid);
  }
  return uid;
}

/** One frame's worth of state for every element that declared motion. */
export function sampleMotion(root: Element): AuditedElement[] {
  const out: AuditedElement[] = [];
  for (const el of root.querySelectorAll<HTMLElement>('[data-motion]')) {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    out.push({
      uid: uidOf(el),
      target: describe(el),
      kind: el.dataset.motion ?? '',
      opacity: Number(style.opacity),
      transform: style.transform,
      visibility: style.visibility,
      width: box.width,
      height: box.height,
      contentKey: `${el.childElementCount}:${(el.textContent ?? '').length}`,
    });
  }
  return out;
}

function auditAnimation(animation: Animation): AuditedAnimation | null {
  const effect = animation.effect;
  const target = (effect as KeyframeEffect | null)?.target;
  if (!effect || !target) return null;

  const timing = effect.getTiming();
  const duration = typeof timing.duration === 'number' ? timing.duration : 0;

  // Every property named anywhere in the keyframes. `offset`, `composite` and
  // `easing` are keyframe metadata rather than animated properties, so they are
  // dropped — leaving them in would make every animation look like it animates
  // something called `easing`.
  const properties = new Set<string>();
  for (const frame of (effect as KeyframeEffect).getKeyframes()) {
    for (const key of Object.keys(frame)) {
      if (key === 'offset' || key === 'composite' || key === 'easing' || key === 'computedOffset') {
        continue;
      }
      properties.add(key);
    }
  }

  return {
    target: describe(target),
    duration,
    iterations: timing.iterations === Infinity ? -1 : (timing.iterations ?? 1),
    properties: [...properties],
  };
}

/** Every Web Animations animation the document is running, document-wide. */
function auditAnimations(): AuditedAnimation[] {
  const out: AuditedAnimation[] = [];
  // Deliberately document-wide rather than scoped to the mounted tree: Mantine
  // portals its modals, drawers and notifications to `document.body`, and an
  // animation that escapes the tree is exactly the one worth catching.
  for (const animation of document.getAnimations()) {
    const audited = auditAnimation(animation);
    if (audited) out.push(audited);
  }
  return out;
}

/** One animation frame. */
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Take a motion audit: two samples, `frameGap` animation frames apart.
 *
 * Two frames rather than one by default. A single frame is enough for Framer,
 * which writes a new inline style every frame, and not always enough for a CSS
 * transition whose first frame the compositor may not have painted yet — and a
 * rule that only sometimes sees the motion is worse than one that never does.
 *
 * `samples` takes more than two, for the question M5 asks: did anything that
 * had arrived leave again? That is invisible in a pair — a flicker's start and
 * end look identical — so a navigation is audited across a span of frames
 * rather than at its ends.
 */
export async function collectMotion(
  root: Element,
  label: string,
  { reducedMotion = false, settled = false, frameGap = 2, samples = 2 } = {}
): Promise<MotionAudit> {
  const frames: AuditedElement[][] = [sampleMotion(root)];
  const animations = auditAnimations();

  for (let s = 1; s < samples; s += 1) {
    for (let i = 0; i < frameGap; i += 1) await nextFrame();
    frames.push(sampleMotion(root));
  }

  return { label, reducedMotion, settled, frames, animations };
}
