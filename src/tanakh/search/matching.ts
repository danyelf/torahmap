// What counts as a match, for both the search that finds verses and the
// highlighter that marks them.

import { isWordSeparator, normalizeHebrewForSearch, splitIntoWords } from '../../hebrew.ts';
import { ENGLISH, HEBREW, type TextLanguage } from '../../types.ts';

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

  // A whole English word is bounded by punctuation as well as by space.
  if (mode === 'word' && language === ENGLISH) {
    const pattern = new RegExp(`\\b${escapeForRegex(needle)}\\b`, 'g');
    let match;
    while ((match = pattern.exec(haystack)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
      if (ranges.length >= limit) break;
    }
    return ranges;
  }

  if (mode === 'word') return wholeWords(haystack, needle, limit);

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

// A search asks with the same term for every verse; splitting it each time
// doubles the cost of the search.
let split: { needle: string; words: string[] } = { needle: '', words: [] };

function wordsOf(needle: string): string[] {
  if (split.needle !== needle) {
    split = { needle, words: splitIntoWords(needle).map(({ word }) => word) };
  }
  return split.words;
}

/**
 * A Hebrew word, or phrase, with a separator or the end of the text on both
 * sides. Between a phrase's words any run of separators will do: the text
 * writes `[לְכָה־]נָּא` and the reader types לכה נא.
 *
 * Checked at each occurrence of the first word rather than by splitting the
 * verse into words, which costs ten times as much on every verse searched.
 */
function wholeWords(haystack: string, needle: string, limit: number): TextRange[] {
  const words = wordsOf(needle);
  if (words.length === 0) return [];

  const ranges: TextRange[] = [];
  const edge = (i: number) => i < 0 || i >= haystack.length || isWordSeparator(haystack[i]);
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(words[0], from);
    if (at === -1) break;
    from = at + 1;
    if (!edge(at - 1)) continue;

    let end = at + words[0].length;
    for (const word of words.slice(1)) {
      let next = end;
      while (next < haystack.length && isWordSeparator(haystack[next])) next++;
      end = next > end && haystack.startsWith(word, next) ? next + word.length : -1;
      if (end === -1) break;
    }
    if (end !== -1 && edge(end)) {
      ranges.push({ start: at, end });
      if (ranges.length >= limit) break;
    }
  }
  return ranges;
}
