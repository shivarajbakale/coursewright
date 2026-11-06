import type { Scene } from './scene';
export interface SceneProblem {
    kind: 'node-overlap' | 'outside' | 'label-on-node' | 'label-overlap' | 'group-intrudes';
    ids: string[];
    /** Overlap in square pixels, or distance outside in pixels. */
    amount: number;
}
/**
 * Checks a laid-out scene for things a reader would see as broken: nodes on
 * top of each other or off the canvas, labels covering nodes or each other,
 * or a group frame cutting through a node that is not in it. Used by tests
 * and by the playground's debug overlay.
 */
export declare function checkScene(scene: Scene, tolerance?: number): SceneProblem[];
