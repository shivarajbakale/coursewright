import type { LayoutFn } from '../scene';
/**
 * Overlapping sets. `set a "Label"` declares a circle (two or three of them);
 * items say where they belong with `in a & b`. Items with no `in` sit outside
 * every circle. The radius grows until every region holds its items.
 */
export declare const venn: LayoutFn;
