import { describe, expect, it } from 'vitest';

import { M1, M2, M3, M4, M5, type AuditedElement, type MotionAudit } from '../rules/motion';

let uid = 0;

/** An element that has arrived: fully opaque, where the layout put it. */
function el(overrides: Partial<AuditedElement> = {}): AuditedElement {
  return {
    uid: (uid += 1),
    target: '<div data-motion="reveal">',
    kind: 'reveal',
    opacity: 1,
    transform: 'none',
    visibility: 'visible',
    width: 200,
    height: 100,
    contentKey: '2:14',
    ...overrides,
  };
}

function audit(frames: AuditedElement[][], overrides: Partial<MotionAudit> = {}): MotionAudit {
  return {
    label: 'Dashboard',
    reducedMotion: false,
    settled: false,
    frames,
    animations: [],
    ...overrides,
  };
}

const HIDDEN = el({ opacity: 0, transform: 'matrix(1, 0, 0, 1, 0, 8)' });
const HALFWAY = el({ opacity: 0.5, transform: 'matrix(1, 0, 0, 1, 0, 4)' });

/** The same node at two moments — what M5 needs and `el()` alone cannot give. */
const same = (node: AuditedElement, overrides: Partial<AuditedElement>) => ({
  ...node,
  ...overrides,
});

describe('M1 — reduced motion', () => {
  it('is silent on a run that did not ask for reduced motion', () => {
    expect(M1(audit([[HIDDEN], [HALFWAY]]))).toEqual([]);
  });

  it('flags an element still moving between samples', () => {
    const out = M1(audit([[HALFWAY], [el()]], { reducedMotion: true }));
    expect(out.some((v) => v.message.includes('still animating'))).toBe(true);
  });

  it('flags an element that starts hidden, even if it snaps a frame later', () => {
    // The failure a naive implementation ships: no animation, but a first
    // frame of blank page, which is the symptom the setting exists to prevent.
    const out = M1(audit([[HIDDEN], [HIDDEN]], { reducedMotion: true }));
    expect(out).toHaveLength(1);
    expect(out[0].message).toContain('starts hidden');
  });

  it('accepts an app that renders its end state on the first frame', () => {
    expect(M1(audit([[el()], [el()]], { reducedMotion: true }))).toEqual([]);
  });

  it('allows a loading indicator to keep pulsing', () => {
    const shimmer = {
      target: '<div data-slot="skeleton">',
      duration: 1500,
      iterations: -1,
      properties: ['opacity'],
    };
    const out = M1(
      audit([[el()], [el()]], { reducedMotion: true, animations: [shimmer] })
    );
    expect(out).toEqual([]);
  });

  it('flags a CSS animation that ignores the setting', () => {
    const out = M1(
      audit([[el()], [el()]], {
        reducedMotion: true,
        animations: [
          { target: '<div data-panel="hero">', duration: 400, iterations: 1, properties: ['transform'] },
        ],
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0].detail.durationMs).toBe(400);
  });
});

describe('M2 — settled visible', () => {
  it('says nothing about an audit taken mid-flight', () => {
    // Asking "did everything arrive" of a page that is still animating fails
    // every animation in the app for doing its job.
    expect(M2(audit([[HIDDEN], [HALFWAY]]))).toEqual([]);
  });

  it('flags an entrance that never finished', () => {
    const out = M2(audit([[HIDDEN], [HIDDEN]], { settled: true }));
    expect(out).toHaveLength(2);
    expect(out.map((v) => v.rule)).toEqual(['M2', 'M2']);
    expect(out[0].message).toContain('opacity 0.00');
    expect(out[1].message).toContain('transform');
  });

  it('ignores an element that is deliberately not rendered', () => {
    expect(
      M2(audit([[el({ visibility: 'hidden', opacity: 0 })]], { settled: true }))
    ).toEqual([]);
  });

  it('accepts an arrived element', () => {
    expect(M2(audit([[el()], [el()]], { settled: true }))).toEqual([]);
  });

  it('treats a rounding-error opacity as arrived', () => {
    expect(M2(audit([[el({ opacity: 0.9999999 })]], { settled: true }))).toEqual([]);
  });

  it('treats an identity matrix as arrived', () => {
    expect(
      M2(audit([[el({ transform: 'matrix(1, 0, 0, 1, 0, 0)' })]], { settled: true }))
    ).toEqual([]);
  });
});

describe('M3 — composited and finite', () => {
  it('flags an element that changes size while animating', () => {
    const out = M3(audit([[el({ height: 40 })], [el({ height: 120 })]]));
    expect(out).toHaveLength(1);
    expect(out[0].detail.deltaHeight).toBe(80);
  });

  it('ignores a sub-pixel box change', () => {
    expect(M3(audit([[el({ width: 200 })], [el({ width: 200.3 })]]))).toEqual([]);
  });

  it('flags a forever loop that is not a loading indicator', () => {
    const out = M3(
      audit([[el()], [el()]], {
        animations: [
          { target: '<div class="logo">', duration: 2000, iterations: -1, properties: ['transform'] },
        ],
      })
    );
    expect(out).toHaveLength(1);
    expect(out[0].message).toContain('loops forever');
  });

  it('allows a skeleton to loop forever', () => {
    const out = M3(
      audit([[el()], [el()]], {
        animations: [
          { target: '<div class="mantine-Skeleton-root">', duration: 1500, iterations: -1, properties: ['opacity'] },
        ],
      })
    );
    expect(out).toEqual([]);
  });

  it('skips the box comparison when the element’s contents changed', () => {
    // Skeletons became rows. The box grew because React committed, not because
    // anything is animating layout — this failed Inbox, Team and Billing.
    expect(
      M3(audit([[el({ height: 40, contentKey: '8:0' })], [el({ height: 420, contentKey: '27:900' })]]))
    ).toEqual([]);
  });

  it('skips the box comparison when React committed between samples', () => {
    // Different lengths mean a row arrived or a skeleton left. There is nothing
    // to compare, and guessing at the pairing invents violations.
    expect(M3(audit([[el({ height: 40 })], [el(), el()]]))).toEqual([]);
  });
});

describe('M4 — the app actually moves', () => {
  it('is silent under reduced motion, where stillness is the requirement', () => {
    expect(M4([audit([[el()], [el()]], { reducedMotion: true })])).toEqual([]);
  });

  it('passes when one sample caught something mid-flight', () => {
    expect(M4([audit([[HALFWAY], [el()]])])).toEqual([]);
  });

  it('passes when one audit of several saw movement', () => {
    // The shell animates at mount and the rows animate when their data lands.
    // Either is enough; requiring both would fail a page with no rows.
    const out = M4([audit([[el()], [el()]], { label: 'at mount' }), audit([[HIDDEN], [HALFWAY]])]);
    expect(out).toEqual([]);
  });

  it('fails when every sample caught everything already arrived', () => {
    // The AnimatePresence `initial={false}` defect: motion declared, none
    // running, and every other gate in the repo green.
    const out = M4([audit([[el(), el()], [el(), el()]])]);
    expect(out).toHaveLength(1);
    expect(out[0].rule).toBe('M4');
    expect(out[0].detail.elements).toBe(2);
  });

  it('fails when nothing declares motion at all', () => {
    const out = M4([audit([[], []])]);
    expect(out).toHaveLength(1);
    expect(out[0].message).toContain('declares no [data-motion] elements');
  });
});

describe('M5 — nothing that arrived may leave again', () => {
  it('flags a node that reached full opacity and faded back', () => {
    // The AnimatePresence defect: the destination page rendered at 1, animated
    // itself out to 0, and came back.
    const node = el();
    const out = M5(
      audit([[node], [same(node, { opacity: 0.2 })], [same(node, { opacity: 1 })]])
    );
    expect(out).toHaveLength(1);
    expect(out[0].rule).toBe('M5');
    expect(out[0].detail.arrivedAtSample).toBe(0);
    expect(out[0].detail.regressedAtSample).toBe(1);
  });

  it('reports one violation per flicker, not one per frame', () => {
    const node = el();
    const out = M5(
      audit([[node], [same(node, { opacity: 0.2 })], [same(node, { opacity: 0.1 })]])
    );
    expect(out).toHaveLength(1);
  });

  it('accepts a keyed remount, which is a different node in the same place', () => {
    // The correct route change: the old page's node unmounts and a new one
    // mounts at opacity 0. Identical to the defect unless identity is tracked.
    const leaving = el();
    const arriving = el({ opacity: 0 });
    const out = M5(audit([[leaving], [arriving], [same(arriving, { opacity: 1 })]]));
    expect(out).toEqual([]);
  });

  it('accepts an entrance that has not finished yet', () => {
    const node = el({ opacity: 0 });
    const out = M5(
      audit([[node], [same(node, { opacity: 0.4 })], [same(node, { opacity: 1 })]])
    );
    expect(out).toEqual([]);
  });

  it('ignores an element that is deliberately not rendered', () => {
    const node = el();
    const out = M5(audit([[node], [same(node, { opacity: 0, visibility: 'hidden' })]]));
    expect(out).toEqual([]);
  });

  it('says nothing about a single sample', () => {
    expect(M5(audit([[el()]]))).toEqual([]);
  });
});
