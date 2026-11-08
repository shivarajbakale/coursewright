import type { Span } from './types';
export type CompletionKind = 'keyword' | 'value' | 'shape' | 'name' | 'option' | 'color' | 'icon';
export interface CompletionItem {
    label: string;
    kind: CompletionKind;
    /** A short note shown beside the label, such as a paper's full name. */
    detail?: string;
    /** Longer help, from the language reference. */
    doc?: string;
    /** Text to insert when it differs from the label (quoted square names). */
    insert?: string;
    /** Higher sorts first: the file's own layout words, then the rest. */
    boost?: number;
}
export interface Completions {
    /** The range the chosen item replaces: the word typed so far. */
    from: number;
    to: number;
    items: CompletionItem[];
}
export interface CompleteOptions {
    /** The user asked for completions (Ctrl-Space). Without it, nothing is offered where the next word isn't clear. */
    explicit?: boolean;
}
/** What can be typed at `offset`. Null when nothing fits. */
export declare function complete(source: string, offset: number, options?: CompleteOptions): Completions | null;
export interface Hover {
    from: number;
    to: number;
    /** Markdown: a code line, then what it does. */
    text: string;
}
/** Help for the word at `offset`: a statement, shape, option, setting value or node. */
export declare function hover(source: string, offset: number): Hover | null;
export type SymbolKind = 'node' | 'group' | 'step' | 'set' | 'frame';
export interface DocSymbol {
    name: string;
    kind: SymbolKind;
    /** The label, or a step's caption. */
    detail?: string;
    span: Span;
}
/** Nodes, groups, sets, frames and steps, in source order, for outline views. */
export declare function symbols(source: string): DocSymbol[];
/** Where the name at `offset` is defined: a node's definition line, or a group's. */
export declare function definition(source: string, offset: number): Span | null;
