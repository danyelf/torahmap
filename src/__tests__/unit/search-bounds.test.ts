// A snippet's marked range stays inside the snippet, even where the word ends
// the verse and carries points.
import { describe, it, expect, beforeEach } from 'vitest';
import { excerptOf } from '../helpers/excerpt';
import { buildTextIndex, type SearchResult, type TextIndex } from '../../search';
import { EMPTY_DICTIONARY } from '../helpers/searchData';

const result = (verse: number, language: 'he' | 'en'): SearchResult => ({
  book: 'Genesis',
  chapter: 1,
  verse,
  language,
  matchingTerms: [{ termIndex: 0 }],
});

describe('Snippet bounds', () => {
  let index: TextIndex;
  beforeEach(() => {
    index = buildTextIndex({
      Genesis: {
        '1': {
          '1': { he: 'אֱלֹהִים', en: 'God' },
          '2': { he: 'בְּרֵאשִׁית', en: 'In the beginning' },
        },
      },
    });
  });

  it.each([
    [1, 'he', 'אלהים'],
    [2, 'he', 'בראשית'],
    [1, 'en', 'God'],
    [2, 'en', 'beginning'],
  ] as const)('keeps the mark inside the snippet (verse %i, %s)', (verse, language, term) => {
    const { snippet, matchStart, matchEnd } = excerptOf(
      result(verse, language),
      term,
      'word',
      index,
      EMPTY_DICTIONARY,
    )!;

    expect(matchStart).toBeGreaterThanOrEqual(0);
    expect(matchEnd).toBeGreaterThan(matchStart);
    expect(matchEnd).toBeLessThanOrEqual(snippet.length);
  });

  it('marks the whole of a pointed word that ends the verse', () => {
    const { snippet, matchStart, matchEnd } = excerptOf(
      result(1, 'he'),
      'אלהים',
      'word',
      index,
      EMPTY_DICTIONARY,
    )!;
    expect(snippet.slice(matchStart, matchEnd)).toBe('אֱלֹהִים');
  });
});
