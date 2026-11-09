import { ENGLISH } from '@torahmap/shell/language.ts';
import type { TextRange } from '@torahmap/utils';
import type { SearchLanguage } from './language.ts';

/** A term is text a reader typed, so it can hold anything a regex reads. */
function escapeForRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The letters beyond a–z in the shipped English, as `scripts/search/english-letters-report.ts` finds them. */
export const ENGLISH_LETTERS = 'ḥḤéÉçÇïÏàÀĥĤ';

/** Each of `ENGLISH_LETTERS` read as its plain letter, which keeps a position's place in the text. */
const ACCENTED = new RegExp(`[${ENGLISH_LETTERS}]`, 'g');
const plainLetter = (letter: string) => letter.normalize('NFD')[0]!;

/** English: lowercased and without accents, a word bounded by punctuation as well as by space (accents are already plain when a word is read). */
export const english: SearchLanguage = {
  id: ENGLISH,
  rtl: false,
  claims: () => true,
  fold: (text) => text.toLowerCase().replace(ACCENTED, plainLetter),
  toOriginalRange: (_text, folded) => folded,
  wholeWords(haystack, needle, limit) {
    const ranges: TextRange[] = [];
    const pattern = new RegExp(`(?<!\\w)${escapeForRegex(needle)}(?!\\w)`, 'g');
    let match;
    while ((match = pattern.exec(haystack)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
      if (ranges.length >= limit) break;
    }
    return ranges;
  },
};
