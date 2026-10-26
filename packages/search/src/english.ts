import { ENGLISH } from '@torahmap/shell/language.ts';
import type { TextRange } from '@torahmap/utils';
import type { SearchLanguage } from './language.ts';

/** A term is text a reader typed, so it can hold anything a regex reads. */
function escapeForRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The letters beyond a–z in the shipped English, as `scripts/search/english-letters-report.ts` finds them. */
export const ENGLISH_LETTERS = 'ḥḤéÉçÇïÏàÀĥĤ';

/** A character that continues a word: what `\b` counts, plus `ENGLISH_LETTERS`. */
const WORD_CHARACTER = `[\\w${ENGLISH_LETTERS}]`;

/** English: lowercased, a word bounded by punctuation as well as by space. */
export const english: SearchLanguage = {
  id: ENGLISH,
  rtl: false,
  claims: () => true,
  fold: (text) => text.toLowerCase(),
  toOriginal: (_text, foldedAt) => foldedAt,
  wholeWords(haystack, needle, limit) {
    const ranges: TextRange[] = [];
    const pattern = new RegExp(
      `(?<!${WORD_CHARACTER})${escapeForRegex(needle)}(?!${WORD_CHARACTER})`,
      'g',
    );
    let match;
    while ((match = pattern.exec(haystack)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
      if (ranges.length >= limit) break;
    }
    return ranges;
  },
};
