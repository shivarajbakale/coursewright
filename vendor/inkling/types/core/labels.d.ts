import type { Box, Scene } from './scene';
import type { Doc } from './types';
export declare function overlapArea(a: Box, b: Box): number;
/** Wraps note text at about `max` characters per line, keeping written line breaks. */
export declare function wrapText(text: string, max?: number): string;
export declare function placeLabels(scene: Scene, doc: Doc): void;
