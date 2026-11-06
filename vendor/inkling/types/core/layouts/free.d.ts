import type { LayoutFn } from '../scene';
/**
 * Free placement: `at x,y` for exact centres, or `below`, `above`,
 * `left of`, `right of` another node. The author decides; the humaniser only
 * tilts, never moves.
 */
export declare const free: LayoutFn;
