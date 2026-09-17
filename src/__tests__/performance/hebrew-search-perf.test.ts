// Performance diagnostic tests for Hebrew search.
//
// These log timings to help a human compare modes, but assert only
// correctness — a wall-clock budget here measures whatever else the machine
// is doing, not the search itself (see search-performance.test.ts, which hit
// this directly). A slow search still shows up as a slow test run.
import { describe, it, expect, beforeAll } from 'vitest';
import { search, buildSearchIndex } from '../../search';
import { searchInMeaningsMode } from '../helpers/meaningsSearch';
import { buildLargeVerseTexts } from '../helpers/largeVerseTexts';

describe('Hebrew Search Performance Diagnostics', () => {
  beforeAll(() => {
    buildSearchIndex(buildLargeVerseTexts(5000));
    // Warmup: JIT-compile the search path before measuring
    search('אלהים', false, 'substring');
  });

  // Helper to measure execution time
  function measureTime<T>(fn: () => T, label: string): { result: T; timeMs: number } {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    const timeMs = end - start;
    console.log(`${label}: ${timeMs.toFixed(2)}ms`);
    return { result, timeMs };
  }

  describe('Performance: Meanings mode (default for Hebrew)', () => {
    it('measures meanings mode search for single common term', () => {
      const term = 'אלהים'; // God - appears in ~2600 verses

      const { result } = measureTime(() => {
        return searchInMeaningsMode(term);
      }, 'search("אלהים", meanings mode) - ~2600 results');

      console.log(`  Found ${result.length} results`);

      // This is where we expect to see the lag
      // Record the actual time for analysis
      expect(result.length).toBeGreaterThan(0);
    });

    it('measures meanings mode search for multiple terms', () => {
      const terms = 'אלהים, יהוה'; // God, LORD

      const { result } = measureTime(() => {
        return searchInMeaningsMode(terms);
      }, 'search("אלהים, יהוה", meanings mode) - multiple terms');

      console.log(`  Found ${result.length} results`);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Performance: Substring mode', () => {
    it('measures substring search for single term', () => {
      const term = 'אלהים';

      const { result } = measureTime(() => {
        return search(term, false, 'substring');
      }, 'search("אלהים", substring mode)');

      console.log(`  Found ${result.length} results`);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Performance: Word mode', () => {
    it('measures whole-word search for single term', () => {
      const term = 'אלהים';

      const { result } = measureTime(() => {
        return search(term, false, 'word');
      }, 'search("אלהים", word mode)');

      console.log(`  Found ${result.length} results`);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Performance: Comparison across modes', () => {
    it('compares all three modes for the same term', () => {
      const term = 'אלהים';

      const substring = measureTime(() => search(term, false, 'substring'), 'Substring');
      const word = measureTime(() => search(term, false, 'word'), 'Word');
      const meanings = measureTime(() => searchInMeaningsMode(term), 'Meanings');

      console.log('\nMode comparison:');
      console.log(
        `  Substring: ${substring.timeMs.toFixed(2)}ms (${substring.result.length} results)`,
      );
      console.log(`  Word:      ${word.timeMs.toFixed(2)}ms (${word.result.length} results)`);
      console.log(
        `  Meanings: ${meanings.timeMs.toFixed(2)}ms (${meanings.result.length} results)`,
      );

      // All modes should return results
      expect(substring.result.length).toBeGreaterThan(0);
      expect(word.result.length).toBeGreaterThan(0);
      expect(meanings.result.length).toBeGreaterThan(0);
    });
  });

  describe('Performance: Interactive typing simulation', () => {
    it('simulates typing "אלהים" character by character', () => {
      const chars = ['א', 'אל', 'אלה', 'אלהי', 'אלהים'];

      console.log('\nSimulating typing (meanings mode):');
      for (const partial of chars) {
        const { result, timeMs } = measureTime(() => {
          return searchInMeaningsMode(partial);
        }, `  "${partial}"`);

        console.log(`    -> ${result.length} results in ${timeMs.toFixed(2)}ms`);
      }
    });
  });
});
