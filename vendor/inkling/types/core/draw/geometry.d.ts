import type { Box, SceneNode } from '../scene';
export type Pt = [number, number];
export declare function polyLength(pts: Pt[]): number;
/** The point and direction at distance `d` along a polyline. */
export declare function along(pts: Pt[], d: number): {
    p: Pt;
    dir: Pt;
};
export declare function overlap(a: Box, b: Box): number;
export declare function nodeBox(n: SceneNode, pad?: number): Box;
export declare function labelBox(n: SceneNode): Box;
export declare function wrap(text: string, max?: number): string;
