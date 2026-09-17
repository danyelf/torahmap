// Marking search terms inside a piece of text: which stretches a term claims,
// and the <mark> spans that show them.
//
// Everything here takes the terms as an argument, so nothing in this file knows
// what the search currently holds.
import type { TextLanguage } from '../../types.ts';
import { mapStrippedToOriginal, splitIntoWords } from '../../hebrew.ts';
import { foldForMatching, matchRangesInFolded } from '../../search/matching.ts';
import { wordMatches } from '../../search/dictionary.ts';
import { effectiveMode, selectedKeys, type SearchTerm } from '../../search/terms.ts';

/**
 * A term's colour is carried on the mark's class, and the stylesheet holds one
 * rule per colour slot. Both highlighters below go through here, so the class
 * name is written once.
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
function findAllTermMatches(text: string, searchTerms: SearchTerm[], isHebrew: boolean): Match[] {
  const matches: Match[] = [];
  const language = isHebrew ? 'he' : 'en';
  const folded = foldForMatching(text, language);
  const toOriginal = (at: number) => (isHebrew ? mapStrippedToOriginal(text, at) : at);

  for (let termIndex = 0; termIndex < searchTerms.length; termIndex++) {
    const term = searchTerms[termIndex];
    // The mode belongs to the term. `isHebrew` is the language of the verse
    // text being marked up, which is a different question.
    const mode = effectiveMode(term);

    // Meanings mode asks the dictionary, not the spelling: mark only the words
    // that are one of the meanings this term still stands for.
    //
    // By position rather than by spelling, which is what separates the two
    // words spelled עלה in Genesis 8:20 — a spelling could be either, and only
    // the place in the verse says which this one is. `wordMatches` falls back
    // to the spelling wherever the parse cannot answer (see
    // search/dictionary.ts), so a verse that does not line up still marks.
    if (isHebrew && mode === 'meanings') {
      const keys = selectedKeys(term);
      const needle = foldForMatching(term.text, 'he');
      for (const { word, start, end } of splitIntoWords(folded)) {
        const hit = keys.length > 0 ? wordMatches(keys, word, text, start) : word === needle;
        if (hit) {
          matches.push({ start: toOriginal(start), end: toOriginal(end), termIndex });
        }
      }
      continue;
    }

    for (const { start, end } of matchRangesInFolded(folded, foldForMatching(term.text, language), {
      mode: mode === 'word' ? 'word' : 'substring',
      language,
    })) {
      matches.push({ start: toOriginal(start), end: toOriginal(end), termIndex });
    }
  }

  return matches;
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

    fragment.appendChild(mark(text.slice(m.start, m.end), terms[m.termIndex]?.colorIndex ?? 0));

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
): DocumentFragment {
  const fragment = document.createDocumentFragment();

  if (terms.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  const isHebrew = language === 'he';

  const matches = findAllTermMatches(text, terms, isHebrew);

  if (matches.length === 0) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  // Longest match first, so removeOverlappingMatches keeps it over a shorter one.
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  return buildHighlightedDomFragment(text, removeOverlappingMatches(matches), terms);
}
