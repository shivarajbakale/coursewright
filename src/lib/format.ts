/**
 * Number and money formatting.
 *
 * Money is carried through the app in **cents**, as an integer, and converted
 * to a string only here. A float dollar amount accumulates rounding error the
 * moment you sum a book of business, and a revenue figure that is off by a cent
 * is a bug report.
 *
 * `Intl.NumberFormat` rather than a hand-rolled template: it places the symbol,
 * the group separators and the decimals per locale, and it is what keeps a
 * table of figures aligned when one of them crosses a thousand.
 */

/** `4825000` → `"$48,250.00"`. Full precision — use in detail views and tables. */
export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

/**
 * `4825000` → `"$48,250"`. No cents.
 *
 * Recurring revenue is quoted whole: the cents are noise beside the number, and
 * a KPI tile has no room for them.
 */
export function formatMoneyWhole(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * `4825000` → `"$48.3K"`, `128_400_000` → `"$1.3M"`.
 *
 * For axis ticks and chart tooltips, where the full figure would collide with
 * its neighbour.
 */
export function formatMoneyCompact(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

/**
 * A signed change, as a percentage of `previous`.
 *
 * Returns `null` when `previous` is zero: growth from nothing is not a
 * percentage, and rendering `Infinity%` — or silently showing `100%` — is the
 * kind of number a starter should never teach anyone to print.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** `2.134` → `"2.1%"`. One decimal, because churn lives in the tenths. */
export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}
