/** Creating SVG elements in whichever document the drawing targets. */
export declare const NS = "http://www.w3.org/2000/svg";
type Attrs = Record<string, string | number>;
export declare function useDocument(d: Document): void;
export declare function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Attrs, parent?: Element): SVGElementTagNameMap[K];
export {};
