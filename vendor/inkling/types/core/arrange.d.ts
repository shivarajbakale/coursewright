import { type Box, type Scene, type SceneNode } from './scene';
import type { AnnotationDef, Doc } from './types';
/** Moves everything in the scene by (dx, dy). */
export declare function shiftScene(scene: Scene, dx: number, dy: number): void;
export declare const nodeBox: (n: SceneNode, pad?: number) => Box;
export declare const GROUP_PAD = 14;
/** Draws a frame around each group's members, with room for its name. Inner groups first. */
export declare function fitGroups(scene: Scene, doc: Doc): void;
/** Keeps everything at least `margin` from the top-left, and grows the canvas to fit. */
export declare function normalize(scene: Scene, margin?: number): void;
/** Makes room for the title above everything and records where it goes. */
export declare function applyTitle(scene: Scene, doc: Doc): void;
/**
 * The region a mark points at, shaped like a node so marks can treat nodes,
 * groups and arrows alike.
 */
export declare function markTarget(scene: Scene, a: AnnotationDef): SceneNode | undefined;
export declare function midpoint(pts: [number, number][]): [number, number];
