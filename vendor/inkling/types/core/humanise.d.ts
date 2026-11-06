import { type Pt, type Scene } from './scene';
import type { Doc } from './types';
/**
 * Nudges and tilts nodes so the drawing does not look machine-placed. How far
 * depends on the mess setting and on the layout's own limits.
 */
export declare function humanise(scene: Scene, doc: Doc, rand: () => number): void;
/**
 * Turns each edge's route into its final line: ends trimmed to the shapes,
 * a gentle bow on direct lines, and parallel arrows fanned apart.
 */
export declare function routeEdges(scene: Scene, doc: Doc, rand: () => number): void;
/** Liang–Barsky clipping: does segment p→q cross the box? */
export declare function segmentHitsBox(p: Pt, q: Pt, box: {
    x: number;
    y: number;
    w: number;
    h: number;
}): boolean;
