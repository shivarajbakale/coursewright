import type { AnnotationKind, Doc, FrameKind, Shape } from '../types';
export declare const SHAPES: Shape[];
export declare const SHAPE_ALIASES: Record<string, Shape>;
export declare const MARKS: AnnotationKind[];
export declare const SETTINGS: readonly ['title', 'layout', 'direction', 'paper', 'pen', 'hand', 'mess', 'seed', 'steps', 'inkling', 'root', 'center', 'footer', 'colors', 'gap', 'branches'];
/** Statements of the chart layout. */
export declare const CHART_WORDS: string[];
/** Sequence frames. */
export declare const FRAME_WORDS: FrameKind[];
export declare const KEYWORDS: string[];
/** Options written as key=value, and which statements take them. */
export declare const NODE_OPTIONS: string[];
export declare const EDGE_OPTIONS: string[];
/**
 * Statements that only draw in some layouts. Anywhere else they are read but
 * ignored, with W-WRONG-LAYOUT. Completion offers them first in their layout.
 */
export declare const LAYOUT_WORDS: Record<string, string[]>;
/**
 * Words kept working after a rename, with what to write instead. Each use
 * gives W-DEPRECATED with a fix. Removed only in 2.0 (see docs/language.md).
 */
export declare const DEPRECATED: Record<string, {
    use: string;
    since: string;
}>;
/** Words saved for later versions, so adding them is never a breaking change. Using one as a statement is E-RESERVED. */
export declare const RESERVED: string[];
/** The newest language version this parser reads. */
export declare const LANGUAGE_VERSION = 1;
/** A slug for ids made from text: lower case, words joined by hyphens. */
export declare const slug: (text: string) => string;
/** Parses Inkling source. Never throws: problems become diagnostics and the line is skipped. */
export declare function parse(source: string): Doc;
