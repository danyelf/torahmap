// Assembling results from verse sets.
//
// The verse sets arrive already decided, and this turns them into results.
// Resolving a term's text to lexemes happens where the reader's choice of
// meanings lives — the overlay — not in search().

import { describe, it, expect, beforeAll } from 'vitest';
import { loadLexiconData, buildSearchIndex, resultsForVerseSets } from '../../search.ts';
import type { VerseTexts } from '../../verseTexts.ts';

const texts: VerseTexts = {
  Genesis: {
    1: { 1: { he: 'בראשית ברא אלהים', en: 'In the beginning' } },
    3: { 7: { he: 'עלה תאנה', en: 'fig leaves' } },
  },
};

beforeAll(async () => {
  await loadLexiconData();
  buildSearchIndex(texts);
});

describe('resultsForVerseSets', () => {
  it("turns one term's verse set into results for those verses", () => {
    const results = resultsForVerseSets([new Set(['Genesis:1:1'])]);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ book: 'Genesis', chapter: 1, verse: 1 });
    expect(results[0].matchingTerms.map((m) => m.termIndex)).toEqual([0]);
  });

  it('records both terms on a verse that matches both', () => {
    const results = resultsForVerseSets([
      new Set(['Genesis:1:1']),
      new Set(['Genesis:1:1', 'Genesis:3:7']),
    ]);

    const first = results.find((r) => r.verse === 1);
    expect(first?.matchingTerms.map((m) => m.termIndex)).toEqual([0, 1]);
    expect(results).toHaveLength(2);
  });

  it('keeps a gap where a term has no hits, so colours stay put', () => {
    const results = resultsForVerseSets([new Set(), new Set(['Genesis:3:7'])]);

    expect(results).toHaveLength(1);
    expect(results[0].matchingTerms.map((m) => m.termIndex)).toEqual([1]);
  });

  it('ignores verse keys the loaded text does not have', () => {
    expect(resultsForVerseSets([new Set(['Nowhere:9:9'])])).toEqual([]);
  });
});
