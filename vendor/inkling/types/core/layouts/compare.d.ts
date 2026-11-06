import type { LayoutFn } from '../scene';
/**
 * X versus Y: `columns` headings and `row` lines. Headings are underlined,
 * rows are separated by hand-drawn rules, columns by a wobbly divider; no
 * full grid. With exactly two columns a circled "vs" sits between them.
 * `direction down` swaps rows and columns.
 */
export declare const compare: LayoutFn;
