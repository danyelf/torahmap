// What counts as a match, for both the search that finds verses and the
// highlighter that marks them.
//
// These were two implementations for a while, and they disagreed three times:
// on the sof pasuq ending a verse, on the joiner inside Jerusalem, and on a
// term typed with a plain letter where the verse has a final form. Each looked
// like a bug in the highlighter and was really the two rules drifting apart.

import { normalizeHebrewForSearch, splitIntoWords } from '../hebrew.ts';

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
export function foldForMatching(text: string, language: 'he' | 'en'): string {
  return language === 'he' ? normalizeHebrewForSearch(text) : text.toLowerCase();
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
  options: { mode: MatchMode; language: 'he' | 'en'; limit?: number },
): TextRange[] {
  const { mode, language, limit = Infinity } = options;
  if (needle.length === 0 || limit <= 0) return [];

  const ranges: TextRange[] = [];

  // A whole word in English is bounded by punctuation as well as by space,
  // which is what \b says and what splitting on separators would miss.
  if (mode === 'word' && language === 'en') {
    const pattern = new RegExp(`\\b${escapeForRegex(needle)}\\b`, 'g');
    let match;
    while ((match = pattern.exec(haystack)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
      if (ranges.length >= limit) break;
    }
    return ranges;
  }

  if (mode === 'word') {
    for (const { word, start, end } of splitIntoWords(haystack)) {
      if (word === needle) {
        ranges.push({ start, end });
        if (ranges.length >= limit) break;
      }
    }
    return ranges;
  }

  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;
    ranges.push({ start: at, end: at + needle.length });
    if (ranges.length >= limit) break;
    from = at + 1;
  }
  return ranges;
}

/**
 * Where `term` matches `text`, folding both. Positions are in the folded text,
 * which for Hebrew is not the text passed in because the points are gone; map
 * back with mapStrippedToOriginal. Folding never turns one character into two,
 * so a position is always valid.
 */
export function matchRanges(
  text: string,
  term: string,
  options: { mode: MatchMode; language: 'he' | 'en'; limit?: number },
): TextRange[] {
  const folded = foldForMatching(text, options.language);
  const needle = foldForMatching(term, options.language);
  return matchRangesInFolded(folded, needle, options);
}
