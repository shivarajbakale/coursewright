export interface Piece {
    el: SVGElement;
    mode: 'stroke' | 'fade' | 'clip';
    len: number;
    clip?: SVGRectElement;
    clipX?: number;
    clipW?: number;
}
export interface Item {
    step: number;
    rank: number;
    pieces: Piece[];
    dur: number;
    start: number;
}
export interface StepInfo {
    index: number;
    caption?: string;
    start: number;
    end: number;
}
export interface Drawing {
    svg: SVGSVGElement;
    items: Item[];
    steps: StepInfo[];
    duration: number;
}
/** Collects every drawn path in a group as pieces, outlines before fills. */
export declare function piecesFrom(g: Element, ink: string, fadeAll?: boolean): Piece[];
