import type { LayoutFn } from '../scene';
/**
 * Layers stacked top to bottom (or left to right with `layout stack` +
 * `direction right`). Top-level bullets, or nodes in source order, are the
 * layers; child bullets sit side by side inside their layer.
 */
export declare const stack: LayoutFn;
