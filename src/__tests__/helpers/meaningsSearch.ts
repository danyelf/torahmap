// Meanings-mode search, run the way the search overlay runs it: a term is
// resolved to the dictionary words it could be, and the verses of the chosen
// meanings are unioned. A word the dictionary does not know finds nothing.
//
// This runs that sequence with every meaning left checked, which is what the
// reader gets before touching anything. Tests can then describe meanings-mode
// behaviour without driving the overlay's DOM.

import { parseSearchTerms, resultsForVerseSets, type SearchResult } from '../../search';
import { versesFor } from '../../search/dictionary';
import { addTerm, selectedKeys, type SearchTerm } from '../../search/terms';

export function searchInMeaningsMode(query: string): SearchResult[] {
  const terms = parseSearchTerms(query).reduce(addTerm, [] as SearchTerm[]);

  return resultsForVerseSets(
    terms.map((term) => versesFor(selectedKeys(term))),
    terms.map(() => 'he' as const),
  );
}
