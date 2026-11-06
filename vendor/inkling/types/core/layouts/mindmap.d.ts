import type { LayoutFn } from '../scene';
/**
 * One idea branching out. The tree comes from outline bullets, or from
 * arrows (`root x` picks the centre). The root is a cloud, first-level ideas
 * are round boxes, deeper ones are underlined text. Branches are tapered
 * curves, split between the left and right sides; `direction down` grows an
 * org-chart-style tree instead.
 */
export declare const mindmap: LayoutFn;
