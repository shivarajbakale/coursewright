/**
 * Makes an SVG self-contained: replaces the Google Fonts @import with
 * @font-face rules that carry the font files inline, trimmed to the
 * characters the drawing uses. The result renders anywhere — image viewers,
 * design tools, email — without network access.
 *
 * Needs `fetch` (browsers, Node 18+). Fonts come from Google Fonts unless
 * `cssUrl` points somewhere else.
 */
export interface EmbedOptions {
    /** Builds the stylesheet URL for a family, weights and text. Defaults to Google Fonts with `text=` subsetting. */
    cssUrl?: (family: string, weights: number[], text: string) => string;
    fetch?: typeof fetch;
}
export declare function embedFonts(svg: string, options?: EmbedOptions): Promise<string>;
