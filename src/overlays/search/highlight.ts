// Marking search terms inside a piece of text: which stretches a term claims,
// and the <mark> spans that show them.
//
// Everything here takes the terms as an argument, so nothing in this file knows
// what the search currently holds.
import { ENGLISH, HEBREW, type TextLanguage } from '../../types.ts';
import {
  mapStrippedToOriginal,
  onlySeparators,
  splitIntoWords,
  stripNikkud,
} from '../../hebrew.ts';
import { foldForMatching, matchRangesInFolded } from '../../search/matching.ts';
import { wordMatches, wordsOfVerse, type Parse, type VerseWords } from '../../search/dictionary.ts';
import {
  displayedVerse,
  quoteVerse,
  type Dictionary,
  type SearchResult,
  type Snippet,
  type TextIndex,
} from '../../search.ts';
import {
  colorIndexAt,
  effectiveMode,
  selectedKeys,
  termIsHebrew,
  type SearchTerm,
} from '../../search/terms.ts';

/**
 * A term's colour is carried on the mark's class, and the stylesheet holds one
 * rule per colour slot. Both highlighters in this file go through here, so the
 * class name is written once.
 */
function mark(text: string, colorIndex: number): HTMLElement {
  const element = document.createElement('mark');
  element.className = `term-${colorIndex}`;
  element.textContent = text;
  return element;
}

/** One mark over a range the search has already located. */
export function markRange(
  text: string,
  start: number,
  end: number,
  colorIndex: number,
): DocumentFragment {
  const fragment = document.createDocumentFragment();

  if (start > 0) {
    fragment.appendChild(document.createTextNode(text.slice(0, start)));
  }

  fragment.appendChild(mark(text.slice(start, end), colorIndex));

  if (end < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(end)));
  }

  return fragment;
}

interface Match {
  start: number;
  end: number;
  termIndex: number;
}

/** Handles nikkud stripping and position mapping; respects each term's own search mode. */
function findAllTermMatches(
  text: string,
  searchTerms: SearchTerm[],
  isHebrew: boolean,
  dictionary: Dictionary,
  words: VerseWords | null,
): Match[] {
  const matches: Match[] = [];
  const language = isHebrew ? HEBREW : ENGLISH;
  const folded = foldForMatching(text, language);
  const toOriginal = (at: number) => (isHebrew ? mapStrippedToOriginal(text, at) : at);

  for (let termIndex = 0; termIndex < searchTerms.length; termIndex++) {
    const term = searchTerms[termIndex];
    // The mode belongs to the term. `isHebrew` is the language of the verse
    // text being marked up, which is a different question.
    const mode = effectiveMode(dictionary, term);

    // Meanings mode asks the dictionary, not the spelling: mark only the words
    // that are one of the meanings this term still stands for.
    //
    // By position rather than by spelling, which is what separates the two
    // words spelled עלה in Genesis 8:20 — a spelling could be either, and only
    // the place in the verse says which this one is. A meaning is Hebrew, so it
    // marks nothing in English.
    if (mode === 'meanings') {
      const keys = selectedKeys(dictionary, term);
      if (!isHebrew || keys.length === 0) continue;
      for (const { word, start, end } of splitIntoWords(folded)) {
        if (wordMatches(dictionary, words, keys, word, text, start)) {
          matches.push({ start: toOriginal(start), end: toOriginal(end), termIndex });
        }
      }
      continue;
    }

    const needle = foldForMatching(term.text.trim(), language);
    for (const { start, end } of matchRangesInFolded(folded, needle, { mode, language })) {
      matches.push({ start: toOriginal(start), end: toOriginal(end), termIndex });
    }
  }

  return matches;
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
  const text = displayedVerse(index, result, isHebrew ? HEBREW : ENGLISH);
  if (text === null) return null;
  const words = isHebrew ? wordsOfVerse(parse, result.id, text) : null;
  const [first, ...rest] = findAllTermMatches(text, [term], isHebrew, dictionary, words);
  if (!first) return quoteVerse(text, null);

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
  return quoteVerse(text, { start: first.start, end });
}

/** Assumes matches are already sorted by position. */
function removeOverlappingMatches(matches: Match[]): Match[] {
  const filtered: Match[] = [];
  for (const m of matches) {
    if (filtered.length === 0 || m.start >= filtered[filtered.length - 1].end) {
      filtered.push(m);
    }
  }
  return filtered;
}

function buildHighlightedDomFragment(
  text: string,
  matches: Match[],
  terms: SearchTerm[],
): DocumentFragment {
  const fragment = document.createDocumentFragment();

  let pos = 0;
  for (const m of matches) {
    if (m.start > pos) {
      fragment.appendChild(document.createTextNode(text.slice(pos, m.start)));
    }

    fragment.appendChild(mark(text.slice(m.start, m.end), colorIndexAt(terms, m.termIndex)));

    pos = m.end;
  }

  if (pos < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(pos)));
  }

  return fragment;
}

/**
 * Mark every stretch of `text` that one of `terms` claims.
 *
 * Builds the DOM directly rather than through innerHTML. The terms are the ones
 * being searched, in search order, because a match names its term by position
 * in that list.
 */
export function highlightTerms(
  text: string,
  language: TextLanguage,
  terms: SearchTerm[],
  dictionary: Dictionary,
  words: VerseWords | null,
): DocumentFragment {
  const fragment = document.createDocumentFragment();

  if (terms.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  const isHebrew = language === HEBREW;

  const matches = findAllTermMatches(text, terms, isHebrew, dictionary, words);

  if (matches.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  // Longest match first, so removeOverlappingMatches keeps it over a shorter one.
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  return buildHighlightedDomFragment(text, removeOverlappingMatches(matches), terms);
}
