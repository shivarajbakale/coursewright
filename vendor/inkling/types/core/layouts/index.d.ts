import type { LayoutFn, Scene } from '../scene';
import type { Doc } from '../types';
/** Every layout by name. New layouts register here. */
export declare const LAYOUTS: Record<string, LayoutFn>;
/**
 * Everything before ink: place (the layout), humanise, frame groups, make
 * room for the title, route arrows, then place labels and notes.
 */
export declare function layout(doc: Doc): Scene;
