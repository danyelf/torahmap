// What the Tanakh's meanings mode marks in a verse, and a result row's
// quotation of its verse. Marking itself is @torahmap/search's.
import { onlySeparators, splitIntoWords, stripNikkud } from '@torahmap/hebrew';
import {
  displayedText,
  highlightTerms as markTerms,
  quoteText,
  termRanges,
  type SearchResult,
  type SearchTerm,
  type Snippet,
  type TermMatcher,
  type TextIndex,
  type TextRange,
} from '@torahmap/search';
import { ENGLISH, HEBREW, type TextLanguage } from '@torahmap/shell/language.ts';
import { wordMatches, wordsOfVerse, type Parse, type VerseWords } from './dictionary.ts';
import type { Dictionary } from './search.ts';
import { effectiveMode, selectedKeys, termIsHebrew } from './meanings.ts';
import { searchLanguage } from './languages.ts';

/**
 * How the Tanakh's terms are matched in a verse's text.
 *
 * Meanings mode asks the dictionary, not the spelling: it marks only the words
 * that are one of the meanings the term still stands for.
 *
 * By position rather than by spelling, which is what separates the two words
 * spelled עלה in Genesis 8:20 — a spelling could be either, and only the place
 * in the verse says which this one is. A meaning is Hebrew, so it marks nothing
 * in English.
 */
export function tanakhMatcher(dictionary: Dictionary, words: VerseWords | null): TermMatcher {
  return {
    modeOf: (term) => effectiveMode(dictionary, term),
    rangesOf(term, text, language) {
      if (effectiveMode(dictionary, term) !== 'meanings') return null;
      const keys = selectedKeys(dictionary, term);
      if (language.id !== HEBREW || keys.length === 0) return [];
      const folded = language.fold(text);
      const ranges: TextRange[] = [];
      for (const { word, start, end } of splitIntoWords(folded)) {
        if (wordMatches(dictionary, words, keys, word, text, start)) {
          ranges.push({
            start: language.toOriginal(text, start),
            end: language.toOriginal(text, end),
          });
        }
      }
      return ranges;
    },
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
  const [first, ...rest] = termRanges(text, language, term, tanakhMatcher(dictionary, words));
  if (!first) return quoteText(text, null);

  // Meanings mode marks word by word, so a phrase it finds, בית אל, is joined
  // into one mark; a word repeated, קדוש קדוש קדוש, is not. A word's points
  // lie after its mark, so they do not part it from the next.
  let end = first.end;
  const joinable =
    effectiveMode(dictionary, term) === 'meanings' ? splitIntoWords(term.text).length - 1 : 0;
  for (const next of rest.slice(0, joinable)) {
    const between = stripNikkud(text.slice(end, next.start));
    if (!onlySeparators(between, 0, between.length)) break;
    end = next.end;
  }
  return quoteText(text, { start: first.start, end });
}

/** Mark every stretch of a verse's `text` that one of `terms` claims. */
export function highlightTerms(
  text: string,
  language: TextLanguage,
  terms: SearchTerm[],
  dictionary: Dictionary,
  words: VerseWords | null,
): DocumentFragment {
  return markTerms(text, searchLanguage(language), terms, tanakhMatcher(dictionary, words));
}
