export { parse } from './syntax/parser';
/**
 * Rewrites one setting line (`paper notebook`) in the source, or inserts it
 * after the title. Keeps code the single source of truth when a control changes.
 */
export declare function setDirective(source: string, key: string, value: string | number): string;
