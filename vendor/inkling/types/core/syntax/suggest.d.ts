/** "Did you mean" suggestions by edit distance. */
/** The closest candidate, if it is close enough to be a likely typo. */
export declare function closest(word: string, candidates: Iterable<string>): string | undefined;
export declare function didYouMean(word: string, candidates: Iterable<string>): string | undefined;
