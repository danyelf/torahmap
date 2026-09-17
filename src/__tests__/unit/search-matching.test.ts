// Search and the highlighter answer "does this match?" the same way now.
// Each case below is one where they used to answer differently.

import { describe, it, expect, beforeEach } from 'vitest';
import { searchOverlay, highlightSearchTerms } from '../../overlays/search';
import { buildSearchIndex, search } from '../../search';
import { matchRangesInFolded, foldForMatching } from '../../search/matching';
import type { VerseTexts } from '../../verseTexts';

const GENESIS_1_1 = 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';

const texts: VerseTexts = {
  Genesis: {
    '1': { '1': { he: GENESIS_1_1, en: 'In the beginning God created heaven and earth' } },
  },
};

function marked(text: string, language: 'he' | 'en'): string[] {
  const fragment = highlightSearchTerms(text, language);
  const host = document.createElement('div');
  host.appendChild(typeof fragment === 'string' ? document.createTextNode(fragment) : fragment);
  return [...host.innerHTML.matchAll(/<mark[^>]*>([^<]*)<\/mark>/g)].map((m) => m[1]);
}

describe('the search and the highlighter agree', () => {
  beforeEach(() => {
    buildSearchIndex(texts);
  });

  it('on a term typed with a plain letter where the verse has a final form', () => {
    // הארצ as typed; the verse writes הארץ. Folding makes them one spelling,
    // and for a while only the search side folded.
    expect(search('הארצ', false, 'word')).toHaveLength(1);

    searchOverlay.applyUrlParams({ q: 'הארצ', mode: 'word' } as never);
    expect(marked(GENESIS_1_1, 'he').map((m) => m.replace(/[^א-ת]/g, ''))).toEqual(['הארץ']);
  });

  it('on the last word of a verse, which carries the sof pasuq', () => {
    expect(search('הארץ', false, 'word')).toHaveLength(1);

    searchOverlay.applyUrlParams({ q: 'הארץ', mode: 'word' } as never);
    expect(marked(GENESIS_1_1, 'he')).toHaveLength(1);
  });
});

describe('where a term matches', () => {
  const folded = (text: string) => foldForMatching(text, 'he');

  it('finds a Hebrew word only as a whole word', () => {
    const haystack = folded('אלהים ואלהים');
    expect(
      matchRangesInFolded(haystack, folded('אלהים'), { mode: 'word', language: 'he' }),
    ).toHaveLength(1);
    expect(
      matchRangesInFolded(haystack, folded('אלהים'), { mode: 'substring', language: 'he' }),
    ).toHaveLength(2);
  });

  it('treats English punctuation as a word boundary, which splitting on spaces would not', () => {
    const ranges = matchRangesInFolded('in the beginning, god', 'beginning', {
      mode: 'word',
      language: 'en',
    });
    expect(ranges).toEqual([{ start: 7, end: 16 }]);
  });

  it('does not read a term as a pattern', () => {
    expect(matchRangesInFolded('a.c abc', 'a.c', { mode: 'substring', language: 'en' })).toEqual([
      { start: 0, end: 3 },
    ]);
  });

  it('stops at the limit, for callers that only ask whether there is a match', () => {
    expect(
      matchRangesInFolded('aaaa', 'a', { mode: 'substring', language: 'en', limit: 1 }),
    ).toHaveLength(1);
  });
});
