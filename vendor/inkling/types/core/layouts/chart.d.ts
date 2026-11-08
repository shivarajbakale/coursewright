import type { LayoutFn } from '../scene';
/**
 * Price charts and the marks traders draw on them. `candles` and `prices`
 * put one bar per value along the x axis; `curve` plots x,y points on a
 * number line instead (a payoff diagram). On top: `level` and `zone`
 * across the chart, `trend` lines, `buy` and `sell` arrows at a bar, and
 * `stop` and `target` lines from the trade on, with the reward to risk.
 * Nodes with `at bar,price` sit on the chart, so circles and notes work.
 */
export declare const chart: LayoutFn;
