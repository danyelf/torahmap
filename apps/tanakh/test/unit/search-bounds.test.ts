// A snippet's marked range stays inside the snippet, even where the word ends
// the verse and carries points.
import { describe, it, expect } from 'vitest';
import { type SearchResult } from '@torahmap/search';
import { excerptOf } from '../helpers/excerpt';
import { searchDataFor } from '../helpers/searchData';

const result = (verse: number): SearchResult => ({
  id: `Genesis.1.${verse}`,
  ref: `Genesis 1:${verse}`,
  matchingTerms: [{ termIndex: 0 }],
});

describe('Snippet bounds', () => {
  const data = searchDataFor({
    Genesis: {
      '1': {
        '1': { he: 'אֱלֹהִים', en: 'God' },
        '2': { he: 'בְּרֵאשִׁית', en: 'In the beginning' },
      },
    },
  });

  it.each([
    [1, 'אלהים'],
    [2, 'בראשית'],
    [1, 'God'],
    [2, 'beginning'],
  ] as const)('keeps the mark inside the snippet (verse %i, %s)', (verse, term) => {
    const { snippet, matchStart, matchEnd } = excerptOf(result(verse), term, 'word', data)!;

    expect(matchStart).toBeGreaterThanOrEqual(0);
    expect(matchEnd).toBeGreaterThan(matchStart);
    expect(matchEnd).toBeLessThanOrEqual(snippet.length);
  });

  it('marks the whole of a pointed word that ends the verse', () => {
    const { snippet, matchStart, matchEnd } = excerptOf(result(1), 'אלהים', 'word', data)!;
    expect(snippet.slice(matchStart, matchEnd)).toBe('אֱלֹהִים');
  });
});
