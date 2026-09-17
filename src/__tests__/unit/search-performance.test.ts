// Correctness checks for Hebrew search at production scale (~23,000 verses).
//
// No time budget is asserted here, and adding one measures the wrong thing: a
// budget catches cold start and whatever else the machine is doing rather than
// the search itself. Against a 200ms budget this suite failed twice at ~230ms
// purely from CPU contention, then passed eight consecutive runs on an idle
// machine. Meanings-mode search is about 1ms once warm, so a genuinely slow
// search still shows up as a slow test run.
import { describe, it, expect, beforeAll } from 'vitest';
import { search, buildSearchIndex } from '../../search';
import { searchInMeaningsMode } from '../helpers/meaningsSearch';
import { buildLargeVerseTexts } from '../helpers/largeVerseTexts';

describe('Search Performance', () => {
  // Use beforeAll — building a 23k-verse index once is enough,
  // and avoids re-indexing overhead contaminating each test's timing.
  beforeAll(() => {
    buildSearchIndex(buildLargeVerseTexts(23000));

    // Warmup: JIT-compile the search path before measuring
    search('אלהים', false, 'substring');
    searchInMeaningsMode('אלהים');
  });

  it('substring mode finds the common word', () => {
    const results = search('אלהים', false, 'substring');

    expect(results.length).toBeGreaterThan(0);
  });

  it('word mode finds the common word', () => {
    const results = search('אלהים', false, 'word');

    expect(results.length).toBeGreaterThan(0);
  });

  it('meanings mode finds the common word', () => {
    const results = searchInMeaningsMode('אלהים');

    expect(results.length).toBeGreaterThan(0);
  });

  it('meanings mode finds multiple search terms', () => {
    const results = searchInMeaningsMode('אלהים, יהוה');

    expect(results.length).toBeGreaterThan(0);
  });
});
