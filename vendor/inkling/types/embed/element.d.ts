/**
 * Where the handwriting fonts come from. Pass your own stylesheet URL to
 * self-host them, or null if the page already loads them.
 */
export declare function setFontSource(url: string | null): void;
/** Loads the handwriting fonts once. Drawings measure text, so they wait for this. */
export declare function loadHands(): Promise<unknown>;
declare const ElementBase: typeof HTMLElement;
export declare class InklingDiagram extends ElementBase {
    static observedAttributes: string[];
    private root;
    private diagram;
    private player;
    private source;
    private io;
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(name: string, _old: string | null, value: string | null): void;
    /** Replace the source from script. */
    set code(v: string);
    private overrides;
    private draw;
}
export declare function defineInkling(): void;
declare global {
    interface HTMLElementTagNameMap {
        'inkling-diagram': InklingDiagram;
    }
}
export {};
