import { type TextIndex } from '@torahmap/search';
// Correctness checks for Hebrew search at production scale (~23,000 verses).
//
// No time budget is asserted here, and adding one measures the wrong thing: a
// budget catches cold start and whatever else the machine is doing rather than
// the search itself. Against a 200ms budget this suite failed twice at ~230ms
// purely from CPU contention, then passed eight consecutive runs on an idle
// machine. Meanings-mode search is about 1ms once warm, so a genuinely slow
// search still shows up as a slow test run.
import { describe, it, expect, beforeAll } from 'vitest';
import { textIndexOf, type SearchData } from '../../src/search/data';
import { versesForTerm } from '../helpers/searchData';
import { searchInMeaningsMode } from '../helpers/meaningsSearch';
import { withRealDictionary } from '../helpers/searchData';
import { buildLargeVerseTexts } from '../helpers/largeVerseTexts';

describe('Search Performance', () => {
  let data: SearchData;
  let index: TextIndex;
  // Use beforeAll — building a 23k-verse index once is enough,
  // and avoids re-indexing overhead contaminating each test's timing.
  beforeAll(() => {
    const texts = buildLargeVerseTexts(23000);
    data = withRealDictionary(texts);
    index = textIndexOf(data);

    // Warmup: JIT-compile the search path before measuring
    versesForTerm(index, 'אלהים', 'he', 'substring');
    searchInMeaningsMode(data, 'אלהים');
  });

  it('substring mode finds the common word', () => {
    expect(versesForTerm(index, 'אלהים', 'he', 'substring').size).toBeGreaterThan(0);
  });

  it('word mode finds the common word', () => {
    expect(versesForTerm(index, 'אלהים', 'he', 'word').size).toBeGreaterThan(0);
  });

  it('meanings mode finds the common word', () => {
    const results = searchInMeaningsMode(data, 'אלהים');

    expect(results.length).toBeGreaterThan(0);
  });

  it('meanings mode finds multiple search terms', () => {
    const results = searchInMeaningsMode(data, 'אלהים, יהוה');

    expect(results.length).toBeGreaterThan(0);
  });
});
