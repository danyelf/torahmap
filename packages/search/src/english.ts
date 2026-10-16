import { ENGLISH } from '@torahmap/shell/language.ts';
import type { SearchLanguage, TextRange } from './language.ts';

/** A term is text a reader typed, so it can hold anything a regex reads. */
export function escapeForRegex(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** English: lowercased, a word bounded by punctuation as well as by space. */
export const english: SearchLanguage = {
  id: ENGLISH,
  rtl: false,
  claims: () => true,
  fold: (text) => text.toLowerCase(),
  toOriginal: (_text, foldedAt) => foldedAt,
  wholeWords(haystack, needle, limit) {
    const ranges: TextRange[] = [];
    const pattern = new RegExp(`\\b${escapeForRegex(needle)}\\b`, 'g');
    let match;
    while ((match = pattern.exec(haystack)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length });
      if (ranges.length >= limit) break;
    }
    return ranges;
  },
};
