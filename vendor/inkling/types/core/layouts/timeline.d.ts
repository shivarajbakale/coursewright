import type { LayoutFn } from '../scene';
/**
 * Events along one hand-drawn axis. Bullets are `- date: text`. When every
 * date is a number or an ISO date, events are spaced to scale, and very long
 * gaps are shortened and marked with a zig-zag. Text alternates above and
 * below the axis (or left and right with `direction down`).
 */
export declare const timeline: LayoutFn;
