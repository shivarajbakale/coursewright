/** Width of one line of text in pixels. */
export declare function lineWidth(line: string, px: number, family: string, weight: number): number;
/** Size of a (possibly multi-line) label, with room for the per-letter wobble. */
export declare function measure(text: string, px: number, family: string, weight: number): {
    w: number;
    h: number;
};
