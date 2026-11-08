/** The parsed form of an Inkling source file. */
export type Shape = 'box' | 'round' | 'circle' | 'diamond' | 'cloud' | 'db' | 'sticky' | 'person' | 'icon' | 'text' | 'dot' | 'bullseye';
export type Size = 'small' | 'normal' | 'large';
export type EdgeKind = 'solid' | 'dashed' | 'squiggle';
export type AnnotationKind = 'circle' | 'underline' | 'strike' | 'highlight' | 'note' | 'cross' | 'check';
/** Where something was written: absolute offsets into the source, and its line. */
export interface Span {
    line: number;
    from: number;
    to: number;
}
export interface NodeDef {
    id: string;
    shape: Shape;
    label: string;
    /** Pencil hatching colour, from COLORS. */
    fill?: string;
    /** Ink colour for the outline and label, from INKS. */
    color?: string;
    /** A pen from PENS, overriding the drawing's pen for this node. */
    pen?: string;
    size?: Size;
    /** Icon name, when shape is 'icon'. */
    icon?: string;
    /** The group this node sits in. */
    group?: string;
    /** Free layout: an exact centre, or a position next to another node. */
    at?: [number, number];
    near?: {
        side: 'below' | 'above' | 'left' | 'right';
        of: string;
        gap?: number;
    };
    /** Made from an outline bullet: its depth and the bullet above it. */
    bullet?: {
        level: number;
        parent?: string;
    };
    /** Timeline: the date part of `- 1969: Moon landing`. */
    date?: string;
    /** Compare: a cell's tick, cross or partial tick, and whether it is circled. */
    cell?: {
        mark?: 'yes' | 'no' | 'partly';
        win: boolean;
        row: string;
        column: string;
    };
    /** Compare: a column heading or row label. Venn: a set's name. */
    role?: 'column' | 'row' | 'set';
    /** Venn: the sets an item is in (`in a & b`). Quadrant: the square it is in (`in "Quick wins"`). */
    inside?: string[];
    line: number;
    /** The statement that defines it. For a node made by an arrow, that arrow line. */
    span: Span;
    /** Statement index in the source, for layouts where source order matters. */
    order: number;
    implicit?: boolean;
}
export interface EdgeDef {
    from: string;
    to: string;
    kind: EdgeKind;
    both: boolean;
    label?: string;
    color?: string;
    pen?: string;
    line: number;
    span: Span;
    order: number;
}
export interface AnnotationDef {
    kind: AnnotationKind;
    /** A node id, a group id, or "a->b" for an arrow. */
    target: string;
    /** `region` is a venn overlap, written `a&b`. */
    targetKind: 'node' | 'group' | 'edge' | 'region';
    /** For arrow targets: index into Doc.edges, set once the arrow is found. */
    edgeIndex?: number;
    text?: string;
    color?: string;
    at?: number;
    /** Sequence: `note over a, b`, centred on these lifelines instead of beside one. */
    over?: string[];
    line: number;
    span: Span;
    order: number;
}
export type FrameKind = 'loop' | 'opt' | 'alt' | 'par';
/** Sequence: a box round some messages, such as `loop "every 5s" { … }`. */
export interface FrameDef {
    kind: FrameKind;
    /** The first branch is the frame's own label; `else` and `and` add more. */
    branches: {
        label?: string;
        order: number;
        line: number;
        span: Span;
    }[];
    /** Statement order of the closing }. */
    end: number;
    /** 0 for a frame at the top, 1 inside one frame, and so on. */
    depth: number;
    line: number;
    span: Span;
    order: number;
}
export interface GroupDef {
    id: string;
    label: string;
    members: string[];
    /** Enclosing group, for one level of nesting. */
    parent?: string;
    line: number;
    span: Span;
    order: number;
}
/** `span a..b "label"` on a timeline, or `brace a..b "label"` on a stack. */
export interface RangeDef {
    /** Always 'span' since 1.0; `brace` lines are read as spans. */
    kind: 'span' | 'brace';
    from: string;
    to: string;
    label?: string;
    line: number;
    span: Span;
}
/** One chart statement's position in the source, for diagnostics and linking. */
interface ChartItem {
    line: number;
    label?: string;
    color?: string;
}
/**
 * Chart layout: price data and the marks traders draw on it. Bars are counted
 * from 1. A chart either has bars (candles or price lines) or x,y curves (a
 * payoff diagram), whose x axis is a number line.
 */
export interface ChartDef {
    /** Open, high, low, close per bar. */
    candles: [number, number, number, number][];
    /** `prices` and `line`: one value per bar. `curve`: x,y points. */
    lines: (ChartItem & {
        values?: number[];
        points?: [number, number][];
    })[];
    levels: (ChartItem & {
        price: number;
    })[];
    zones: (ChartItem & {
        from: number;
        to: number;
    })[];
    trades: (ChartItem & {
        side: 'buy' | 'sell';
        bar: number;
        price: number;
    })[];
    stops: (ChartItem & {
        price: number;
    })[];
    targets: (ChartItem & {
        price: number;
    })[];
    trends: (ChartItem & {
        a: [number, number];
        b: [number, number];
    })[];
    /** Labels under the bars or along the x axis, from the first bar on. */
    xlabels: string[];
    axis: {
        x?: string;
        y?: string;
    };
    /** Words at the two ends of an axis: `axis x "Effort" low..high`. */
    ends: {
        x?: [string, string];
        y?: [string, string];
    };
}
export interface StepDef {
    index: number;
    items: string[];
    caption?: string;
    line: number;
    span: Span;
}
export interface Diagnostic {
    /** Stable code, such as E-UNKNOWN-SHAPE. Listed in docs/errors.md. */
    code: string;
    severity: 'error' | 'warning';
    message: string;
    /** A suggested fix, such as 'Did you mean "box"?' */
    hint?: string;
    /** Replacement text for the span, when the fix is mechanical. */
    fix?: {
        span: Span;
        text: string;
    };
    span: Span;
    /** Other places with the same cause, such as every use of one misspelt name. */
    related?: Span[];
}
export type Direction = 'right' | 'down';
export interface Settings {
    /** Which layout places things: flow (default). */
    layout: string;
    direction: Direction;
    paper: string;
    pen: string;
    hand: string;
    mess: number;
    seed: number;
}
export interface Doc extends Settings {
    title?: string;
    nodes: NodeDef[];
    edges: EdgeDef[];
    annotations: AnnotationDef[];
    steps: StepDef[];
    groups: GroupDef[];
    /** `steps auto`: every node becomes its own step, in source order. */
    autoSteps: boolean;
    /** True when the source says `layout right|down` or `direction …`, rather than using the default. */
    directionSet?: boolean;
    /** From an `inkling 1` line, if present. */
    version?: number;
    /** Cycle layout: the order around the circle, and which way it turns. */
    cycle?: {
        ids: string[];
        counterclockwise: boolean;
    };
    /** Cycle layout: text in the middle. */
    center?: string;
    /** Compare layout: column ids in order, and row ids in order. */
    columns: string[];
    rows: string[];
    ranges: RangeDef[];
    /** Mind map: the node at the centre. */
    root?: string;
    /** Mind map: give each branch its own ink. */
    colors: boolean;
    /** Sequence: where each participant's activation box starts and stops. */
    activations: {
        id: string;
        on: boolean;
        order: number;
        span: Span;
    }[];
    /** Venn: set ids in declaration order. */
    sets: string[];
    /** Quadrant: names of the four squares, top left, top right, bottom left, bottom right. */
    quadrants: string[];
    /** Sequence: loop, opt, alt and par frames, outer frames first. */
    frames: FrameDef[];
    /** Sequence: repeat participants at the bottom. */
    footer: boolean;
    /** Tree: elbow (org chart) or straight connectors. */
    branches: 'elbow' | 'straight';
    /** Stack: space between layers, in pixels. */
    gap?: number;
    /** Chart: prices, levels, trades. */
    chart: ChartDef;
    diagnostics: Diagnostic[];
}
export {};
