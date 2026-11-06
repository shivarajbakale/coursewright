import type { Options } from 'roughjs/bin/core';
import type { RoughSVG } from 'roughjs/bin/svg';
import type { Box, Scene } from '../scene';
import type { Paper, Pen } from '../styles';
import type { AnnotationDef, Doc } from '../types';
import type { Piece } from './pieces';
import type { TextStyle } from './text';
/** Everything the drawing passes share while one diagram is drawn. */
export interface DrawContext {
    doc: Doc;
    lay: Scene;
    uid: string;
    svg: SVGSVGElement;
    defs: SVGDefsElement;
    rc: RoughSVG;
    rand: () => number;
    /** Rough.js options for this pen, seeded by a key so each shape has its own wobble. */
    base: (seedKey: string, extra?: Options) => Options;
    roughness: number;
    textStyle: TextStyle;
    paper: Paper;
    pen: Pen;
    ink: string;
    mark: string;
    good: string;
    /** Ink for a named colour on this paper. */
    inkFor: (name: string) => string;
    stepOf: Map<string, number>;
    /** The step an arrow appears in. */
    edgeStep: (index: number) => number;
    /** The step a mark appears in, from what it points at. */
    stepOfTarget: (a: AnnotationDef) => number;
    rankInStep: Map<string, number>;
    add: (step: number, rank: number, pieces: Piece[], dur: number) => void;
    content: SVGGElement;
    groupLayer: SVGGElement;
    decoLayer: SVGGElement;
    edgeLayer: SVGGElement;
    nodeLayer: SVGGElement;
    markLayer: SVGGElement;
    /** Boxes drawn outside the layout's area, which grow the canvas. */
    extra: Box[];
}
