// A search run the way the search overlay runs it, with every meaning left
// checked, which is what the reader gets before touching anything. Tests can
// then describe meanings-mode behaviour without driving the overlay's DOM.
import { addTerm, parseSearchTerms, type SearchResult, type SearchTerm } from '@torahmap/search';
import type { SearchData } from '../../src/search/data.ts';
import { tanakhSearch } from '../../src/search/index.ts';

export function searchInMeaningsMode(data: SearchData, query: string): SearchResult[] {
  const terms = parseSearchTerms(query).reduce(addTerm, [] as SearchTerm[]);
  return tanakhSearch.resultsFor(data, { terms });
}
