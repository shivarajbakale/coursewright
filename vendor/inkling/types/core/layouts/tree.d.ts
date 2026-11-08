import type { LayoutFn } from '../scene';
/**
 * A hierarchy drawn the formal way: org charts, taxonomies, file trees. The
 * tree comes from outline bullets, or from arrows; nodes with no parent are
 * roots, and several roots make a forest side by side. Every level keeps the
 * same shape. `direction down` (default) puts children below their parent,
 * `direction right` beside it. `branches elbow` (default) draws org-chart
 * connectors; `branches straight` draws direct lines.
 */
export declare const tree: LayoutFn;
