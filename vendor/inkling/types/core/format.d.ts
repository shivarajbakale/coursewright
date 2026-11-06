/**
 * Tidies Inkling source without changing what it means:
 * - one space around arrows; `id: shape`, `a -> b : label`, `key=value`, `a, b`
 * - two-space indentation inside groups; bullet indentation kept, in steps of two
 * - no trailing spaces, at most one blank line in a row, one newline at the end
 *
 * Lines the formatter does not fully understand are only trimmed.
 * Formatting twice gives the same result as formatting once.
 */
export declare function format(source: string): string;
