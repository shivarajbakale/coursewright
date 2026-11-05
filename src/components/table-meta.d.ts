import '@tanstack/react-table';

/**
 * Per-column class hooks used by `DataTable` — lets a column hide itself at a
 * breakpoint without the table needing to know about it.
 */
declare module '@tanstack/react-table' {
  /* eslint-disable @typescript-eslint/no-unused-vars */
  interface ColumnMeta<TData, TValue> {
    headClassName?: string;
    cellClassName?: string;
  }
  /* eslint-enable @typescript-eslint/no-unused-vars */
}
