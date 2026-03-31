// Performance diagnostic tests for Hebrew search
// tm-6mw3: Gather evidence about where Hebrew search is slow
import { describe, it, expect, beforeAll } from 'vitest';
import { search, buildSearchIndex, findLemmasForWord } from '../../search';
import type { VerseTexts } from '../../verseTexts';

describe('Hebrew Search Performance Diagnostics', () => {
  beforeAll(() => {
    let mockVerseTexts: VerseTexts;
    // Create a large mock dataset similar to the real one (~23,000 verses)
    // This simulates performance at scale
    mockVerseTexts = {};

    // Generate a realistic mock dataset (use fewer verses for test performance, but enough to measure)
    const books = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];
    const totalVerses = 5000; // Reduced from 23,000 for test speed
    let versesCreated = 0;

    for (const book of books) {
      mockVerseTexts[book] = {};
      const chaptersInBook = Math.floor(totalVerses / books.length / 50); // ~20 chapters per book

      for (let chapter = 1; chapter <= chaptersInBook && versesCreated < totalVerses; chapter++) {
        mockVerseTexts[book][String(chapter)] = {};

        for (let verse = 1; verse <= 50 && versesCreated < totalVerses; verse++) {
          // Mix of verses with common Hebrew words
          const hebrewTexts = [
            'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ',
            'וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר וַיְהִי־אוֹר',
            'וַיַּרְא אֱלֹהִים אֶת־הָאוֹר כִּי־טוֹב',
            'וַיִּקְרָא אֱלֹהִים לָאוֹר יוֹם וְלַחֹשֶׁךְ קָרָא לָיְלָה',
            'וַיְהִי־עֶרֶב וַיְהִי־בֹקֶר יוֹם אֶחָד',
          ];

          mockVerseTexts[book][String(chapter)][String(verse)] = {
            he: hebrewTexts[versesCreated % hebrewTexts.length],
            en: 'In the beginning God created the heavens and the earth',
          };
          versesCreated++;
        }
      }
    }

    buildSearchIndex(mockVerseTexts);
    // Warmup: JIT-compile the search path before measuring
    search('אלהים', false, 'substring');
    findLemmasForWord('אלהים');
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

  describe('Performance: Root mode (default for Hebrew)', () => {
    it('measures findLemmasForWord() performance for common word', () => {
      const word = 'אלהים'; // God - very common word

      const { timeMs } = measureTime(() => {
        return findLemmasForWord(word);
      }, 'findLemmasForWord("אלהים")');

      expect(timeMs).toBeLessThan(10);
    });

    it('measures findLemmasForWord() performance for word with prefix', () => {
      const word = 'ואלהים'; // And God - word with prefix

      const { timeMs } = measureTime(() => {
        return findLemmasForWord(word);
      }, 'findLemmasForWord("ואלהים") - with prefix stripping');

      expect(timeMs).toBeLessThan(20);
    });

    it('measures root mode search for single common term', () => {
      const term = 'אלהים'; // God - appears in ~2600 verses

      const { result } = measureTime(() => {
        return search(term, false, 'root');
      }, 'search("אלהים", root mode) - ~2600 results');

      console.log(`  Found ${result.length} results`);

      // This is where we expect to see the lag
      // Record the actual time for analysis
      expect(result.length).toBeGreaterThan(0);
    });

    it('measures root mode search for multiple terms', () => {
      const terms = 'אלהים, יהוה'; // God, LORD

      const { result } = measureTime(() => {
        return search(terms, false, 'root');
      }, 'search("אלהים, יהוה", root mode) - multiple terms');

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
      const root = measureTime(() => search(term, false, 'root'), 'Root');

      console.log('\nMode comparison:');
      console.log(`  Substring: ${substring.timeMs.toFixed(2)}ms (${substring.result.length} results)`);
      console.log(`  Word:      ${word.timeMs.toFixed(2)}ms (${word.result.length} results)`);
      console.log(`  Root:      ${root.timeMs.toFixed(2)}ms (${root.result.length} results)`);

      // All modes should return results
      expect(substring.result.length).toBeGreaterThan(0);
      expect(word.result.length).toBeGreaterThan(0);
      expect(root.result.length).toBeGreaterThan(0);
    });
  });

  describe('Performance: Interactive typing simulation', () => {
    it('simulates typing "אלהים" character by character', () => {
      const chars = ['א', 'אל', 'אלה', 'אלהי', 'אלהים'];

      console.log('\nSimulating typing (root mode):');
      for (const partial of chars) {
        const { result, timeMs } = measureTime(() => {
          return search(partial, false, 'root');
        }, `  "${partial}"`);

        console.log(`    -> ${result.length} results in ${timeMs.toFixed(2)}ms`);
      }
    });
  });
});
