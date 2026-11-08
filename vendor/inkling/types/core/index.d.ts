import { type Drawing, type DrawOptions, type StepInfo } from './draw';
import type { Doc, Settings } from './types';
export { parse, setDirective } from './parse';
export { layout, LAYOUTS } from './layouts';
export { checkScene, type SceneProblem } from './check';
export { describe, describeLines } from './describe';
export { embedFonts, type EmbedOptions } from './fonts';
export { format } from './format';
export { complete, hover, symbols, definition, type CompletionItem, type CompletionKind, type Completions, type CompleteOptions, type Hover, type DocSymbol, type SymbolKind } from './complete';
export { REFERENCE, type ReferenceGroup, type ReferenceRow } from './syntax/reference';
export { ICONS, ICON_NAMES } from './icons';
export type { Scene, SceneNode, SceneEdge } from './scene';
export { PAPERS, PENS, HANDS, COLORS, FONT_CSS_URL } from './styles';
export type { Diagnostic, Doc, Settings, Span } from './types';
export { tokenize, tokenizeLine, type Token, type TokenType } from './syntax/tokens';
export type { StepInfo } from './draw';
export interface Diagram {
    doc: Doc;
    svg: SVGSVGElement;
    steps: StepInfo[];
    duration: number;
    /** Shows the drawing as it would be `t` seconds into the draw-on animation. */
    seek(t: number): void;
    /** Serialised SVG with the drawing fully finished. */
    toSVG(): string;
    destroy(): void;
}
export interface RenderOptions extends DrawOptions {
}
export declare function render(source: string, overrides?: Partial<Settings>, options?: RenderOptions): {
    doc: Doc;
    drawing: Drawing;
};
/** Above these sizes a drawing is shown without animation. */
export declare const LIMITS: {
    nodes: number;
    edges: number;
    chars: number;
};
/** Renders source into a container. The drawing starts finished; call `seek` to animate. */
export declare function mount(container: Element, source: string, overrides?: Partial<Settings>): Diagram;
/**
 * Plays a diagram's draw-on animation. Pauses briefly at the end of each step
 * so a caption can be read.
 */
export declare class Player {
    t: number;
    playing: boolean;
    speed: number;
    private raf;
    private last;
    private holdUntil;
    private stopAt;
    diagram: Diagram;
    private onTick;
    constructor(diagram: Diagram, onTick?: (p: Player) => void);
    get stepIndex(): number;
    seek(t: number): void;
    play(fromStart?: boolean): void;
    /** Plays only the given step, then stops. */
    playStep(i: number): void;
    next(): void;
    prev(): void;
    pause(): void;
    finish(): void;
    destroy(): void;
    private frame;
}
