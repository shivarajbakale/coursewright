/**
 * Which rules FAIL the probe.
 *
 * Every other rule still runs and still prints, as WARN, and the run exits 0.
 * This is deliberate: Stage 0 ships the measuring instrument before Stages 1-5
 * fix what it measures, and a gate that goes red the day it lands gets disabled
 * rather than obeyed. A rule graduates into this list in the same commit that
 * makes the app satisfy it — the flip *is* that feature's evidence.
 *
 * This list is measured, not chosen: it is exactly the set of rules that
 * reported zero violations across the 2026-08-26 baseline, so every one of them
 * is fatal today at no cost and can never regress silently.
 *
 * Module B is the archetype contract described in
 * `docs/principles/screen-archetypes.md`. Every routed page now declares a
 * `data-archetype` (`src/test/declarations.test.tsx` is the gate that keeps it
 * that way), so B1-B4, B5, B6 and B8 are measured against real pages. B5
 * (`detail`) got its first page when Customers split into a `list` and a
 * `detail` on two routes; B8 (`list`) landed with that split and is enforced
 * from the same commit, because it reported zero the day it was written. B7
 * (`sequence`) still reports nothing — the demo app ships no page of that
 * shape, and it stays enforced so the first page to declare one is held to it
 * immediately, which is how B1-B4 were introduced.
 *
 * Still report-only, with their baseline counts: C6 (32), D4 (26), C1 (12),
 * C2 (9), A3 (9), D3 (6), C3 (3), A1 (3), A5 (1).
 *
 * Module M is motion, and it reads its own audit rather than a snapshot —
 * geometry is a still frame and every question about motion is a question
 * about time. All three land enforced in the commit that adds the motion
 * layer, which is the doctrine above rather than an exception to it: they were
 * written against an app that already satisfies them, and each one names a
 * defect the rest of the harness is structurally blind to. M1 is WCAG 2.3.3 —
 * with `prefers-reduced-motion: reduce` emulated, nothing may animate. M2 is
 * the entrance that never fired, which leaves content in the DOM at zero
 * opacity where every other gate still passes. M3 is the composited-motion
 * rule: nothing changes size while it animates, and nothing loops forever
 * outside a loading indicator. M4 is the anti-vacuity rule — in a run without
 * reduced motion, something must actually have moved — and it is the reason
 * the other three mean anything. It went red the day it was written, on a
 * one-word prop that had silently switched every entrance in the app off. M5
 * is the only rule here that reads a *transition* rather than a mount: nothing
 * that has arrived may fade back while it stays mounted, which is what a
 * reader calls a flicker.
 *
 * T1 is enforced: text must stay inside its enclosing card. T2 joins it: no
 * element may cut off its own text. Three visible defects had shipped behind
 * that gap — `Active 19` rendered as `Active 1`, `ENTERPRISE` as `ENTE…`, and
 * the Inbox filter counts as slivers — each caught by a person looking at a
 * screenshot rather than by a gate. Added in the
 * session that fixed the StatCardWithSub bleed (commit 4efaf54) — after
 * that fix the rule reports zero violations across every page, so
 * enforcing is free.
 */
export const ENFORCED: readonly string[] = [
  'A2',
  'A4',
  'B1',
  'B2',
  'B3',
  'B4',
  'B5',
  'B6',
  'B7',
  'B8',
  'C4',
  'C5',
  'C7',
  'D1',
  'D2',
  'M1',
  'M2',
  'M3',
  'M4',
  'M5',
  'T1',
  'T2',
];
