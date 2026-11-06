import type { Doc } from './types';
/**
 * A plain-language description of a diagram, for screen readers and for the
 * SVG's <desc>. Lists what is grouped, then every arrow in source order,
 * then any notes.
 */
export declare function describeLines(doc: Doc): string[];
export declare function describe(doc: Doc): string;
