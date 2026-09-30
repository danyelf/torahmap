// What counts as a match, for both the search that finds verses and the
// highlighter that marks them.

import { isWordSeparator, normalizeHebrewForSearch } from '../hebrew.ts';
import { ENGLISH, HEBREW, type TextLanguage } from '../types.ts';

export interface TextRange {
  start: number;
  end: number;
}

export type MatchMode = 'substring' | 'word';

/** A term is text a reader typed, so it can hold anything a regex reads. */
export function escapeForRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The spelling text is compared under: folded for Hebrew, lowercased for English. */
export function foldForMatching(text: string, language: TextLanguage): string {
  return language === HEBREW ? normalizeHebrewForSearch(text) : text.toLowerCase();
}

/**
 * Where `needle` sits in `haystack`, both already folded by foldForMatching.
 *
 * The search index stores its text folded, and folding it again for each of
 * 23,000 verses costs twenty times what the search itself does. So the rule
 * lives here and the folding is the caller's, done once.
 *
 * `limit` stops the scan early, for callers that only need to know whether
 * there is a match at all.
 */
export function matchRangesInFolded(
  haystack: string,
  needle: string,
  options: { mode: MatchMode; language: TextLanguage; limit?: number },
): TextRange[] {
  const { mode, language, limit = Infinity } = options;
  if (needle.length === 0 || limit <= 0) return [];

  const ranges: TextRange[] = [];

  // A whole word in English is bounded by punctuation as well as by space,
  // which is what \b says and what splitting on separators would miss.
  if (mode === 'word' && language === ENGLISH) {
    const pattern = new RegExp(`\\b${escapeForRegex(needle)}\\b`, 'g');
    let match;
    while ((match = pattern.exec(haystack)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
      if (ranges.length >= limit) break;
    }
    return ranges;
  }

  // A Hebrew whole word, or phrase, is an occurrence with a separator or the
  // end of the text on both sides. Splitting every verse into words instead
  // costs ten times as much, and a search runs this on every verse.
  const whole = mode === 'word';
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    const end = at + needle.length;
    if (!whole || (endsWord(haystack, at - 1) && endsWord(haystack, end))) {
      ranges.push({ start: at, end });
      if (ranges.length >= limit) break;
    }
    from = at + 1;
  }
  return ranges;
}

function endsWord(text: string, i: number): boolean {
  return i < 0 || i >= text.length || isWordSeparator(text[i]);
}
