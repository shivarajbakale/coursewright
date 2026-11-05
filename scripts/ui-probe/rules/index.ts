import type { Rule, Snapshot, Violation } from '../types';
import { B1, B2, B3, B4, B5, B6, B7, B8 } from './archetype';
import { C1, C2, C3, C4, C5, C6, C7 } from './hierarchy';
import { A1, A2, A3, A4 } from './space';
import { T1, T2 } from './bounds';

/** Every rule that is a pure function of one snapshot. A5 is cross-snapshot. */
export const SNAPSHOT_RULES: Rule[] = [
  A1, A2, A3, A4,
  B1, B2, B3, B4, B5, B6, B7, B8,
  C1, C2, C3, C4, C5, C6, C7,
  T1, T2,
];

export function runRules(s: Snapshot, rules: Rule[] = SNAPSHOT_RULES): Violation[] {
  return rules.flatMap((rule) => rule.check(s));
}
