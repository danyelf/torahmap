// A verse is found in meanings mode exactly when the highlighter marks a word in it.
import { describe, expect, it } from 'vitest';
import { addTerm, parseSearchTerms, type SearchTerm } from '@torahmap/search';
import { searchInMeaningsMode } from '../helpers/meaningsSearch';
import { excerptForTerm } from '../helpers/excerpt';
import { realSearchData } from '../helpers/searchData';
import { tanakhSearch } from '../../src/search/index.ts';

describe('meanings mode finds the verses it marks', () => {
  const { files } = realSearchData();
  const without = { ...files, parse: null };
  const found = (data: typeof files, query: string) =>
    new Set(searchInMeaningsMode(data, query).map((r) => r.id));

  it('counts a verse the per-verse list holds but the parse has no such word in, only before the parse lands', () => {
    // The per-verse list has ארבע in Joshua 21:37; the word-by-word analysis does not.
    expect(found(without, 'ארבע').has('Joshua.21.37')).toBe(true);
    expect(found(files, 'ארבע').has('Joshua.21.37')).toBe(false);
  });

  it('marks a word in every verse it finds once the parse is in', () => {
    for (const query of ['ארבע', 'את', 'עלה']) {
      const [term] = parseSearchTerms(query).reduce(addTerm, [] as SearchTerm[]);
      const results = tanakhSearch.resultsFor(files, { terms: [term] });
      expect(results.length).toBeGreaterThan(0);
      const unmarked = results.filter((r) => {
        const quoted = excerptForTerm(r, term, files);
        return quoted === null || quoted.matchEnd <= quoted.matchStart;
      });
      expect(unmarked.map((r) => r.id)).toEqual([]);
    }
  });
});
