// Search and the highlighter answer "does this match?" through one shared rule.
// Each case below is one a rule of their own would make them disagree on.

import { describe, it, expect, beforeEach } from 'vitest';
import { searchTool as overlay } from '../../overlays/search';
import { hostOverlay } from '../helpers/overlayHost';

const searchOverlay = hostOverlay(overlay);
import { buildSearchIndex, versesForTerm } from '../../search';
import { matchRangesInFolded, foldForMatching } from '../../search/matching';
import type { VerseTexts } from '../../verseTexts';

const GENESIS_1_1 = 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';

const LEVITICUS_1_1 =
  'וַיִּקְרָ֖א אֶל־מֹשֶׁ֑ה וַיְדַבֵּ֤ר יְהֹוָה֙ אֵלָ֔יו מֵאֹ֥הֶל מוֹעֵ֖ד לֵאמֹֽר׃';

const texts: VerseTexts = {
  Genesis: {
    '1': { '1': { he: GENESIS_1_1, en: 'In the beginning God created heaven and earth' } },
  },
  Leviticus: {
    '1': { '1': { he: LEVITICUS_1_1, en: 'The LORD called to Moses and spoke to him' } },
  },
};

function marked(text: string, language: 'he' | 'en'): string[] {
  const fragment = searchOverlay.highlightVerseText(text, language);
  const host = document.createElement('div');
  host.appendChild(typeof fragment === 'string' ? document.createTextNode(fragment) : fragment);
  return [...host.innerHTML.matchAll(/<mark[^>]*>([^<]*)<\/mark>/g)].map((m) => m[1]);
}

describe('the search and the highlighter agree', () => {
  beforeEach(() => {
    buildSearchIndex(texts);
  });

  it('on a term typed with a plain letter where the verse has a final form', () => {
    // הארצ as typed; the verse writes הארץ. Folding makes them one spelling.
    expect(versesForTerm('הארצ', 'he', 'word').size).toBe(1);

    searchOverlay.restore({ search: 'הארצ', mode: 'w' });
    expect(marked(GENESIS_1_1, 'he').map((m) => m.replace(/[^א-ת]/g, ''))).toEqual(['הארץ']);
  });

  it('on the last word of a verse, which carries the sof pasuq', () => {
    expect(versesForTerm('הארץ', 'he', 'word').size).toBe(1);

    searchOverlay.restore({ search: 'הארץ', mode: 'w' });
    expect(marked(GENESIS_1_1, 'he')).toHaveLength(1);
  });

  it.each(['w', undefined])('on a phrase, in mode %s', (mode) => {
    // No dictionary is loaded here, so meanings mode (the default, undefined)
    // matches the phrase by its text.
    expect(versesForTerm('וידבר יהוה', 'he', 'word').size).toBe(1);

    searchOverlay.restore({ search: 'וידבר יהוה', ...(mode ? { mode } : {}) });
    expect(marked(LEVITICUS_1_1, 'he').map((m) => m.replace(/[^א-ת ]/g, ''))).toEqual([
      'וידבר יהוה',
    ]);
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

  it('finds a Hebrew phrase as whole words', () => {
    const haystack = folded('וַיְדַבֵּר יְהוָה אֶל־מֹשֶׁה');
    const find = (term: string) =>
      matchRangesInFolded(haystack, folded(term), { mode: 'word', language: 'he' });
    expect(find('וידבר יהוה')).toEqual([{ start: 0, end: 10 }]);
    expect(find('אל משה')).toHaveLength(1); // written with a maqaf
    expect(find('דבר יהוה')).toEqual([]); // the phrase starts inside a word
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
