import type { LayoutFn } from '../scene';
/**
 * A 2×2 grid: two axes crossing in the middle, four named squares, and items
 * as dots. `at x,y` takes 0 to 1 with 0,0 at the bottom left; `in "Name"`
 * drops an item in a square. Only labels move to keep clear; dots never do.
 */
export declare const quadrant: LayoutFn;
