// How the Tanakh's terms are matched in a verse's text, given its dictionary and
// per-word parse. Marking and quoting are @torahmap/search's.
import {
  displayedText,
  quoteTerm,
  type SearchResult,
  type SearchTerm,
  type Snippet,
  type TermMatcher,
  type TextIndex,
} from '@torahmap/search';
import { ENGLISH, HEBREW } from '@torahmap/shell/language.ts';
import { wordsOfVerse, type Parse, type VerseWords } from './dictionary.ts';
import type { Dictionary } from './search.ts';
import { effectiveMode, meaningRanges, quotedMeaning, termIsHebrew } from './meanings.ts';
import { searchLanguage } from './languages.ts';

/** Each term by its own mode; a term in meanings mode marks the words of its chosen meanings. */
export function tanakhMatcher(dictionary: Dictionary, words: VerseWords | null): TermMatcher {
  return {
    modeOf: (term) => effectiveMode(dictionary, term),
    rangesOf: (term, text, language) =>
      effectiveMode(dictionary, term) === 'meanings'
        ? meaningRanges(dictionary, words, term, text, language)
        : null,
  };
}

/**
 * A result row's quotation of its verse, marked where the verse on screen would
 * be: the same matcher, on the verse the row names, in the term's language.
 */
export function excerpt(
  result: SearchResult,
  term: SearchTerm,
  index: TextIndex,
  dictionary: Dictionary,
  parse: Parse | null,
): Snippet | null {
  const isHebrew = termIsHebrew(term);
  const language = searchLanguage(isHebrew ? HEBREW : ENGLISH);
  const text = displayedText(index, result.id, language);
  if (text === null) return null;
  const words = isHebrew ? wordsOfVerse(parse, result.id, text) : null;
  const quoted =
    effectiveMode(dictionary, term) === 'meanings'
      ? (ranges: Parameters<typeof quotedMeaning>[2]) => quotedMeaning(term, text, ranges)
      : undefined;
  return quoteTerm(text, language, term, tanakhMatcher(dictionary, words), quoted);
}
