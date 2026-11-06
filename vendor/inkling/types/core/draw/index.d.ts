import { type Scene } from '../scene';
import type { Doc } from '../types';
import type { Drawing } from './pieces';
export type { Drawing, Item, Piece, StepInfo } from './pieces';
export interface DrawOptions {
    /** Document to create elements in. Defaults to the global one. */
    document?: Document;
    /** Prefix for ids inside the SVG. Fixed prefixes make output reproducible. */
    idPrefix?: string;
    /** Draw everything at once, with no animation. Used for very large drawings. */
    still?: boolean;
}
/** Inks a scene: paper, title, groups, nodes, arrows, marks, then the animation schedule. */
export declare function draw(doc: Doc, lay: Scene, opts?: DrawOptions): Drawing;
