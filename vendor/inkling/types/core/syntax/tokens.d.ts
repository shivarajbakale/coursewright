/**
 * The tokenizer. Inkling is line-based, so lines are tokenized one at a time.
 * The parser and the playground's editor highlighting both use this, so they
 * always agree on what the syntax is.
 */
export type TokenType = 'ident' | 'string' | 'number' | 'arrow' | 'colon' | 'comma' | 'equals' | 'at' | 'bullet' | 'lbrace' | 'rbrace' | 'comment' | 'dots' | 'word';
export interface Token {
    type: TokenType;
    /** Exactly as written. */
    text: string;
    /** For strings: the unquoted, unescaped value. For `@3`: "3". Otherwise the text. */
    value: string;
    /** Absolute offsets in the whole source. */
    from: number;
    to: number;
    line: number;
    /** Set when the token itself is malformed, such as an unclosed string. */
    error?: string;
}
export declare const ARROWS: readonly ['<~>', '<->', '-->', '->', '~>'];
/** Tokenizes one line. `offset` is where the line starts in the whole source. */
export declare function tokenizeLine(text: string, line: number, offset?: number): Token[];
/** Tokenizes a whole source, one token list per line. */
export declare function tokenize(source: string): Token[][];
