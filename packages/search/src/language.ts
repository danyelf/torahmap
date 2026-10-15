export interface TextRange {
  start: number;
  end: number;
}

/** How text in one language is compared with what a reader types. */
export interface SearchLanguage {
  /** The key an item's text in this language is given under, e.g. 'he'. */
  readonly id: string;
  /** Written right to left. */
  readonly rtl: boolean;
  /** Does a typed term belong to this language? The last language a text lists takes the rest. */
  claims(term: string): boolean;
  /** The spelling text is compared under. */
  fold(text: string): string;
  /** Where a position in folded text falls in the text it came from. */
  toOriginal(text: string, foldedAt: number): number;
  /** Each stretch of folded `haystack` where folded `needle` stands as whole words. */
  wholeWords(haystack: string, needle: string, limit: number): TextRange[];
}
