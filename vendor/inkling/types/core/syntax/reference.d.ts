/**
 * The language reference: what to write and what it does. The playground's
 * Syntax page shows these rows, and editor hover looks words up in them, so
 * the two never disagree.
 *
 * Each row's `keys` say which words it explains:
 *   kw:<word>      a statement's first word (kw:circle, kw:note over)
 *   shape:<name>   a shape after `id:`
 *   opt:<name>     a key=value option
 *   layout:<name>  a value of `layout`
 *   arrow:<arrow>  an arrow
 */
export interface ReferenceRow {
    code: string;
    what: string;
    keys: string[];
}
export interface ReferenceGroup {
    group: string;
    rows: ReferenceRow[];
}
export declare const SHAPE_WORDS: string[];
export declare const REFERENCE: ReferenceGroup[];
/** The row that explains `key` (such as kw:circle or shape:box), if any. */
export declare function lookup(key: string): ReferenceRow | undefined;
