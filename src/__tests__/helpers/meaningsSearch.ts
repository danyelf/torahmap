// A search run the way the search overlay runs it, with every meaning left
// checked, which is what the reader gets before touching anything. Tests can
// then describe meanings-mode behaviour without driving the overlay's DOM.

import {
  parseSearchTerms,
  type Dictionary,
  type SearchResult,
  type TextIndex,
} from '../../tanakh/search/search';
import { matchesForTerms } from '../../tanakh/search/index.ts';
import { addTerm, type SearchTerm } from '../../tanakh/search/terms';

export function searchInMeaningsMode(
  index: TextIndex,
  dictionary: Dictionary,
  query: string,
): SearchResult[] {
  const active = parseSearchTerms(query).reduce(addTerm, [] as SearchTerm[]);
  return matchesForTerms(index, dictionary, active).results;
}
