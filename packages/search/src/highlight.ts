// Marking search terms inside a piece of text: which stretches a term claims,
// and the <mark> spans that show them.
//
// Everything here takes the terms as an argument, so nothing in this file knows
// what the search currently holds.
import { PALETTE } from '@torahmap/shell/overlays/palette.ts';
import { colorToCssAlpha, type TextRange } from '@torahmap/utils';
import type { SearchLanguage } from './language.ts';
import { matchRanges, type MatchMode } from './matching.ts';
import { colorIndexAt, type SearchTerm } from './terms.ts';
import { quoteText, type Snippet } from './textIndex.ts';

/** How each term is matched: its mode, and the stretches its extra mode claims, if it is in one. */
export interface TermMatcher {
  modeOf(term: SearchTerm): string;
  /** Stretches of `text`, in its own positions; null for a term matched by its text. */
  rangesOf?(term: SearchTerm, text: string, language: SearchLanguage): TextRange[] | null;
}

const MARK_ALPHA = 0.4;

/** A term's mark, in the term's colour. Both highlighters in this file go through here. */
export function mark(text: string, colorIndex: number): HTMLElement {
  const element = document.createElement('mark');
  element.style.background = colorToCssAlpha(PALETTE[colorIndex], MARK_ALPHA);
  element.style.color = '#fff';
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

/**
 * The stretches of `text`, written in `language`, that one term claims, in the
 * text's own positions. A term is matched against whatever text it is given:
 * its own language decides how it is searched, the text's how it is marked.
 */
function termRanges(
  text: string,
  language: SearchLanguage,
  term: SearchTerm,
  matcher: TermMatcher,
): TextRange[] {
  const claimed = matcher.rangesOf?.(term, text, language);
  if (claimed) return claimed;

  const folded = language.fold(text);
  const needle = language.fold(term.text.trim());
  const mode = matcher.modeOf(term) as MatchMode;
  return matchRanges(folded, needle, { mode, language }).map(({ start, end }) => ({
    start: language.toOriginal(text, start),
    end: language.toOriginal(text, end),
  }));
}

/**
 * `text` quoted around the first stretch `term` claims in it, or its opening
 * when it claims none. `quoted` picks the stretch from all of them instead.
 */
export function quoteTerm(
  text: string,
  language: SearchLanguage,
  term: SearchTerm,
  matcher: TermMatcher,
  quoted?: (ranges: TextRange[]) => TextRange,
): Snippet {
  const ranges = termRanges(text, language, term, matcher);
  if (ranges.length === 0) return quoteText(text, null);
  return quoteText(text, quoted ? quoted(ranges) : ranges[0]);
}

interface Match extends TextRange {
  termIndex: number;
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
 * Mark every stretch of `text` that one of `terms` claims, and that lies
 * inside one of `within` when given.
 *
 * Builds the DOM directly rather than through innerHTML. The terms are the ones
 * being searched, in search order, because a match names its term by position
 * in that list.
 */
export function highlightTerms(
  text: string,
  language: SearchLanguage,
  terms: SearchTerm[],
  matcher: TermMatcher,
  within?: readonly TextRange[],
): DocumentFragment {
  const inside = (range: TextRange) =>
    !within || within.some((w) => w.start <= range.start && range.end <= w.end);
  const matches: Match[] = terms.flatMap((term, termIndex) =>
    termRanges(text, language, term, matcher)
      .filter(inside)
      .map((range) => ({ ...range, termIndex })),
  );

  if (matches.length === 0) {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  // Longest match first, so removeOverlappingMatches keeps it over a shorter one.
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  return buildHighlightedDomFragment(text, removeOverlappingMatches(matches), terms);
}
