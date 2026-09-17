// Meanings-mode search, run the way the search overlay runs it.
//
// The overlay stopped asking search() for meanings mode when a term gained a choice
// of meanings: search() takes a string, and "only the burnt-offering reading"
// cannot be said in a string. A term is resolved to the dictionary words it
// could be, the verses of the chosen meanings are unioned, and a word the
// dictionary does not know falls back to whole-word matching.
//
// This runs that same sequence with every meaning left checked, which is what
// the reader gets before touching anything. Tests can then describe meanings-mode
// behaviour without driving the overlay's DOM.

import { resultsForVerseSets, verseSetsForTerms, type SearchResult } from '../../search';
import { versesFor } from '../../search/dictionary';
import { addTerm, selectedKeys, type SearchTerm } from '../../search/terms';

export function searchInMeaningsMode(query: string): SearchResult[] {
  const terms = query
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .reduce((list: SearchTerm[], text) => addTerm(list, text), []);

  if (terms.length === 0) return [];

  return resultsForVerseSets(
    terms.map((term) =>
      // A word the dictionary knows is answered from the dictionary; anything
      // else falls back to whole-word matching, as meanings mode always has.
      term.meanings.length > 0
        ? versesFor(selectedKeys(term))
        : verseSetsForTerms([term.text], { hebrewMode: 'word' })[0],
    ),
    terms.map(() => 'he' as const),
  );
}
