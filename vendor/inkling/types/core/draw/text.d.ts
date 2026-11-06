import type { Piece } from './pieces';
export interface TextStyle {
    px: number;
    family: string;
    weight: number;
    color: string;
    mess: number;
}
/**
 * Writes text with a little life in every letter: each glyph gets its own
 * tilt and baseline nudge, so repeated letters never look stamped.
 */
export declare function handText(parent: Element, text: string, cx: number, cy: number, st: TextStyle, rand: () => number, defs: SVGDefsElement, uid: string, anchor?: 'middle' | 'start'): Piece[];
