// What a list of terms finds, and how each is marked and quoted in an item's
// text: the search itself, with no state and no page. createTermSearch runs it
// for the panel and the map; a text's tests run the same functions.
import type { ExtraMode } from './extraMode.ts';
import { quoteTerm, type TermMatcher } from './highlight.ts';
import type { SearchLanguage, TextRange } from './language.ts';
import type { MatchMode } from './matching.ts';
import { effectiveMode, languageOf, type SearchTerm } from './terms.ts';
import {
  displayedText,
  itemsForTerm,
  resultsForItemSets,
  type SearchResult,
  type Snippet,
  type TextIndex,
} from './textIndex.ts';

/** What a search matches with: its languages, its extra mode and that mode's data, and a term's default mode. */
export interface SearchContext<X> {
  readonly languages: readonly SearchLanguage[];
  readonly extra?: ExtraMode<X>;
  readonly x: X | null;
  /** How a term is matched while the reader has not said and the extra mode does not claim it. */
  readonly defaultMode?: MatchMode;
}

/** A term's mode, the extra mode clamped to whole word where it cannot apply. */
export function modeIn<X>(context: SearchContext<X>, term: SearchTerm): string {
  const { languages, extra, x, defaultMode } = context;
  return effectiveMode(term, languages, extra, x, defaultMode);
}

/** Whether `term` is matched by the extra mode, which then has its data. */
export function byExtra<X>(
  context: SearchContext<X>,
  term: SearchTerm,
): context is SearchContext<X> & {
  extra: ExtraMode<X>;
  x: X;
} {
  return (
    context.extra !== undefined && context.x !== null && modeIn(context, term) === context.extra.id
  );
}

/** The items one term finds, by its extra mode or by its text. */
function itemsOf<X>(
  index: TextIndex,
  term: SearchTerm,
  context: SearchContext<X>,
): ReadonlySet<string> {
  if (byExtra(context, term) && context.extra.itemsFor)
    return context.extra.itemsFor(context.x, term);
  const mode = modeIn(context, term);
  // An extra mode without its data finds by whole word, as it does where it cannot apply.
  const match: MatchMode = mode === 'substring' ? 'substring' : 'word';
  return itemsForTerm(index, term.text.trim(), languageOf(context.languages, term), match);
}

/** The items these terms find, each naming the terms, by position, that found it. */
export function resultsOf<X>(
  index: TextIndex,
  terms: readonly SearchTerm[],
  context: SearchContext<X>,
): SearchResult[] {
  return resultsForItemSets(
    index,
    terms.map((term) => itemsOf(index, term, context)),
  );
}

/** How each term is matched within one item's text. */
export function matcherOf<X>(context: SearchContext<X>, itemId: string): TermMatcher {
  return {
    modeOf: (term) => modeIn(context, term),
    rangesOf(term, text, language) {
      if (!byExtra(context, term) || !context.extra.ranges) return null;
      return context.extra.ranges(context.x, term, { itemId, text, language });
    },
  };
}

/** A result row's quotation of its item, marked where the item on screen would be. */
export function excerptOf<X>(
  index: TextIndex,
  result: SearchResult,
  term: SearchTerm,
  context: SearchContext<X>,
): Snippet | null {
  const language = languageOf(context.languages, term);
  const text = displayedText(index, result.id, language);
  if (text === null) return null;
  const quoted =
    byExtra(context, term) && context.extra.quoted
      ? (ranges: TextRange[]) => context.extra!.quoted!(term, text, ranges)
      : undefined;
  return quoteTerm(text, language, term, matcherOf(context, result.id), quoted);
}
