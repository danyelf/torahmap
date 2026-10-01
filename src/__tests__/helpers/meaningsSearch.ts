// A search run the way the search overlay runs it, with every meaning left
// checked, which is what the reader gets before touching anything. Tests can
// then describe meanings-mode behaviour without driving the overlay's DOM.

import { parseSearchTerms, type SearchResult } from '../../search';
import { addTerm, resultsForTerms, type SearchTerm } from '../../search/terms';

export function searchInMeaningsMode(query: string): SearchResult[] {
  return resultsForTerms(parseSearchTerms(query).reduce(addTerm, [] as SearchTerm[]));
}
