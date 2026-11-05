import { ENFORCED } from './probe.config';
import type { Violation } from './types';

export interface ReportResult {
  enforced: Violation[];
  reported: Violation[];
}

function line(kind: 'FAIL' | 'WARN', v: Violation): string {
  const detail = Object.entries(v.detail)
    .map(([k, val]) => `${k}=${typeof val === 'number' ? Math.round(val * 100) / 100 : val}`)
    .join(' ');
  return `  ${kind} ${v.rule}  ${v.message}\n       ${v.selectorHint}${detail ? `  ${detail}` : ''}`;
}

/**
 * Print one view's violations and say which of them are fatal.
 *
 * Report-only output is not decoration. It is the backlog Stages 1-5 work
 * through, and printing it every run is what stops an unenforced rule from
 * quietly becoming a rule nobody remembers.
 */
export function report(label: string, violations: Violation[]): ReportResult {
  const enforced = violations.filter((v) => ENFORCED.includes(v.rule));
  const reported = violations.filter((v) => !ENFORCED.includes(v.rule));

  if (violations.length === 0) {
    console.log(`  OK   ${label}`);
    return { enforced, reported };
  }

  console.log(`  ---  ${label}: ${enforced.length} failing, ${reported.length} report-only`);
  for (const v of enforced) console.log(line('FAIL', v));
  for (const v of reported) console.log(line('WARN', v));
  return { enforced, reported };
}
