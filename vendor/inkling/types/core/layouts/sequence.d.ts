import type { LayoutFn } from '../scene';
/**
 * Who talks to whom, in order. Participants are nodes, left to right as
 * written, each with a lifeline. Arrows are messages, top to bottom in source
 * order; notes sit at the row where they are written. `activate x` and
 * `deactivate x` draw a narrow box on x's lifeline. Frames (`loop`, `opt`,
 * `alt` … `else`, `par` … `and`) box in the messages written inside them.
 */
export declare const sequence: LayoutFn;
