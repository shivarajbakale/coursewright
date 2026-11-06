import { type Scene, type SceneNode } from '../scene';
import type { Doc, NodeDef } from '../types';
export declare const BASE_SIZE = 19;
export interface Sized {
    w: number;
    h: number;
    labelDy: number;
    lw: number;
    lh: number;
}
/** Text style shared by every layout. */
export declare function textMetrics(doc: Doc): {
    px: number;
    family: string;
    weight: number;
};
export declare function shapeSize(def: NodeDef, lw: number, lh: number): {
    w: number;
    h: number;
    labelDy: number;
};
/** Measures every node's label and works out its box. */
export declare function sizeNodes(doc: Doc): Map<string, Sized>;
export declare function titleHeight(doc: Doc): number;
/** Size of one node definition (which may be a layout's restyled copy). */
export declare function sizeDef(doc: Doc, def: NodeDef): Sized;
/** Everything a scene needs besides nodes and edges, for a layout to fill in. */
export declare function emptyScene(doc: Doc, name: string, humanise: Scene['humanise']): Scene;
/** Puts a node into the scene at a centre, using its own size unless one is given. */
export declare function placeNode(scene: Scene, doc: Doc, def: NodeDef, cx: number, cy: number, size?: Partial<Sized>): SceneNode;
/** Sets width and height to cover every node and decoration, plus a margin. */
export declare function fitScene(scene: Scene, margin?: number): void;
export declare function warn(scene: Scene, code: string, message: string, hint?: string): void;
/** Nodes in source order, for layouts where that order is the reading order. */
export declare const inOrder: (doc: Doc) => NodeDef[];
