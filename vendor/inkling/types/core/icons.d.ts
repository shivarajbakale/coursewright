/**
 * Thirty simple icons on a 24 × 24 grid, described as pen strokes so the
 * sketch pen can draw them like everything else.
 */
export type IconPart = {
    t: 'path';
    d: string;
} | {
    t: 'circle';
    cx: number;
    cy: number;
    r: number;
} | {
    t: 'ellipse';
    cx: number;
    cy: number;
    w: number;
    h: number;
} | {
    t: 'rect';
    x: number;
    y: number;
    w: number;
    h: number;
} | {
    t: 'line';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
} | {
    t: 'poly';
    pts: [number, number][];
    closed?: boolean;
};
export declare const ICONS: Record<string, IconPart[]>;
export declare const ICON_NAMES: string[];
