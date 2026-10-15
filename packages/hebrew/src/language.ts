// Hebrew as search reads it. Shaped to @torahmap/search's SearchLanguage, which
// this package does not import: the apps that pass it to search check the fit.
import { isHebrew, mapStrippedToOriginal, splitIntoWords } from './letters.ts';
import { normalizeHebrewForSearch } from './spelling.ts';

interface TextRange {
  start: number;
  end: number;
}

const LETTER = /[א-ת]/;

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
 * A word, or phrase, with no letter on either side. Anything else ends a word:
 * a space, a separator, a bracket, punctuation. Between a phrase's words any
 * run of non-letters will do: the text writes `[לְכָה־]נָּא` and the reader
 * types לכה נא.
 *
 * Given `prefixes`, the first word may carry any run of them in front, and the
 * stretch starts at the first. A prefix is not a word, so the letter before it
 * must still end one: with ד, רבי finds דרבי but not זרבי.
 *
 * Checked at each occurrence of the first word rather than by splitting the
 * text into words, which costs ten times as much on every verse searched.
 */
function wholeWords(
  haystack: string,
  needle: string,
  limit: number,
  prefixes: ReadonlySet<string>,
): TextRange[] {
  const words = wordsOf(needle);
  if (words.length === 0) return [];

  const ranges: TextRange[] = [];
  const edge = (i: number) => i < 0 || i >= haystack.length || !LETTER.test(haystack[i]);
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(words[0], from);
    if (at === -1) break;
    from = at + 1;
    let start = at;
    while (start > 0 && prefixes.has(haystack[start - 1])) start--;
    if (!edge(start - 1)) continue;

    let end = at + words[0].length;
    for (const word of words.slice(1)) {
      let next = end;
      while (next < haystack.length && edge(next)) next++;
      end = next > end && haystack.startsWith(word, next) ? next + word.length : -1;
      if (end === -1) break;
    }
    if (end !== -1 && edge(end)) {
      ranges.push({ start, end });
      if (ranges.length >= limit) break;
    }
  }
  return ranges;
}

/** Hebrew, optionally taking `prefixes`: letters a whole word may carry in front, e.g. 'דולבכשמה'. */
export function hebrew(options: { prefixes?: string } = {}) {
  const prefixes = new Set(options.prefixes ?? '');
  return {
    id: 'he',
    rtl: true,
    claims: isHebrew,
    fold: normalizeHebrewForSearch,
    toOriginal: mapStrippedToOriginal,
    wholeWords: (haystack: string, needle: string, limit: number) =>
      wholeWords(haystack, needle, limit, prefixes),
  } as const;
}
