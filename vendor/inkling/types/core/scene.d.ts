import type { Diagnostic, Doc, EdgeDef, GroupDef, NodeDef } from './types';
/**
 * The scene: everything a layout decides, before any ink. Every layout
 * produces one; the humaniser, the router and the drawing all consume it.
 */
export type Pt = [number, number];
export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface SceneNode {
    def: NodeDef;
    /** Centre. Layouts set it; the humaniser nudges it. */
    cx: number;
    cy: number;
    w: number;
    h: number;
    rotate: number;
    /** Where the label sits, relative to the centre. */
    labelDy: number;
    labelW: number;
    labelH: number;
}
export interface SceneEdge {
    index: number;
    def: EdgeDef;
    /** Bend points chosen by the layout, between the two ends. Empty for a direct line. */
    route: Pt[];
    /** The final line, end to end, set by the router. */
    points: Pt[];
    /** Sideways offset of a direct line's midpoint; its sign says which side the label goes. */
    bend: number;
    /** The layout set `points` itself; the router leaves them alone. */
    fixed?: boolean;
    /** `hidden`: not drawn (the layout draws the connection another way). `plain`: no arrowheads. */
    style?: 'arrow' | 'plain' | 'hidden';
}
export interface SceneGroup {
    def: GroupDef;
    /** The dashed frame. */
    box: Box;
    /** The handwritten name, inside the frame's top-left corner. */
    tab: Box;
}
/** A label whose position the label pass chose: an arrow's label or a note. */
export interface PlacedLabel {
    key: string;
    text: string;
    px: number;
    box: Box;
    /** Where a note's arrow should point, when not at its target's edge (a lifeline). */
    anchor?: Pt;
}
/** What a decoration belongs to, so it appears in the right step. */
export interface Owner {
    node?: string;
    edge?: number;
}
/** Extra ink a layout needs that is not a node or an arrow. */
export type Decoration = ({
    kind: 'line';
    points: Pt[];
    dashed?: boolean;
    arrow?: boolean;
    width?: number;
    color?: 'ink' | 'mark' | string;
    smooth?: boolean;
} | {
    kind: 'brace';
    from: Pt;
    to: Pt; /** Which way the point of the brace faces. */
    toward: Pt;
} | {
    kind: 'text';
    x: number;
    y: number;
    text: string;
    px: number;
    bold?: boolean;
    anchor?: 'middle' | 'start';
    color?: 'ink' | 'mark' | string;
} | {
    kind: 'branch';
    points: Pt[];
    w0: number;
    w1: number;
    color?: string;
} | {
    kind: 'box';
    box: Box;
    dashed?: boolean;
    fill?: string;
} | {
    kind: 'ring';
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    color?: 'ink' | 'mark';
} | {
    kind: 'zigzag';
    at: Pt;
    vertical: boolean;
}) & {
    owner?: Owner;
};
/** How far the humaniser may move things in this layout, at mess 1. */
export interface HumaniseLimits {
    tilt: number;
    stickyTilt: number;
    jitterX: number;
    jitterY: number;
}
export interface Scene {
    layout: string;
    nodes: Map<string, SceneNode>;
    edges: SceneEdge[];
    decorations: Decoration[];
    groups: SceneGroup[];
    /** Arrow labels (`edge:<index>`) and notes (`note:<annotation index>`), set by the label pass. */
    labels: Map<string, PlacedLabel>;
    titleBox?: Box;
    /** Problems the layout noticed, such as a very wide graph. */
    warnings: Diagnostic[];
    width: number;
    height: number;
    titleH: number;
    fontPx: number;
    family: string;
    weight: number;
    humanise: HumaniseLimits;
    /** For `steps auto`: the layout's own order for nodes, arrows and marks. */
    autoSteps?: {
        nodes?: Map<string, number>;
        edges?: Map<number, number>;
        marks?: Map<number, number>;
    };
    /** Nodes the layout styled itself (a mind map's levels, a timeline's events). Overrides the source. */
    defs?: Map<string, NodeDef>;
}
/** A layout places things. It never draws and never adds randomness. */
export type LayoutFn = (doc: Doc) => Scene;
/** Where the line from the centre toward (tx, ty) leaves the shape, plus a gap. */
export declare function boundaryPoint(n: SceneNode, tx: number, ty: number, gap?: number): [number, number];
/** The bounding box of a decoration, for fitting the canvas. */
export declare function decorationBox(d: Decoration, font?: {
    family: string;
    weight: number;
}): Box | undefined;
/** Moves a decoration by (dx, dy). */
export declare function shiftDecoration(d: Decoration, dx: number, dy: number): Decoration;
