/** Papers, pens, hands and colour names. Every colour here is diagram ink, not UI chrome. */
export interface Paper {
    label: string;
    ground: string;
    dark: boolean;
    /** Ink for annotations: the "red pen" on light paper, a yellow chalk on dark. */
    mark: string;
}
export declare const PAPERS: Record<string, Paper>;
export interface Pen {
    label: string;
    ink: string;
    inkOnDark: string;
    width: number;
    /** Extra roughness this pen adds on top of the mess setting. */
    grain: number;
    opacity: number;
}
export declare const PENS: Record<string, Pen>;
export interface Hand {
    label: string;
    family: string;
    /** Size multiplier so different hands read at the same apparent size. */
    scale: number;
    weight: number;
}
export declare const HANDS: Record<string, Hand>;
/** Named fills and highlighter colours you can write in source. */
export declare const COLORS: Record<string, string>;
/** Ink colours for `color=`: a darker value for light paper, a lighter one for dark paper. */
export declare const INKS: Record<string, {
    light: string;
    dark: string;
}>;
export declare const LAYOUT_NAMES: string[];
export declare const SIZES: Record<string, number>;
export declare const STICKY = "#fff2a1";
export declare const DEFAULTS: {
    layout: string;
    direction: 'right';
    paper: string;
    pen: string;
    hand: string;
    mess: number;
    seed: number;
};
export declare const FONT_CSS_URL = "https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&family=Kalam:wght@400;700&family=Patrick+Hand&family=Gochi+Hand&family=Architects+Daughter&display=swap";
