// Performance regression tests for Hebrew search
// tm-6mw3: Ensure search performance meets acceptable thresholds
import { describe, it, expect, beforeEach } from 'vitest';
import { search, buildSearchIndex } from '../../search';
import type { VerseTexts } from '../../verseTexts';

describe('Search Performance', () => {
  let largeVerseTexts: VerseTexts;

  beforeEach(() => {
    // Create a dataset large enough to expose performance issues
    // Simulating ~23,000 verses
    largeVerseTexts = {};
    const books = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];
    const versesPerBook = 4600; // 23,000 / 5

    for (const book of books) {
      largeVerseTexts[book] = {};
      const chaptersInBook = 50;
      const versesPerChapter = Math.ceil(versesPerBook / chaptersInBook);

      for (let chapter = 1; chapter <= chaptersInBook; chapter++) {
        largeVerseTexts[book][String(chapter)] = {};

        for (let verse = 1; verse <= versesPerChapter; verse++) {
          // Use a variety of Hebrew text (some with אלהים, some without)
          const hasGod = Math.random() > 0.5;
          const hebrewTexts = hasGod
            ? 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ'
            : 'וַיֹּאמֶר יְהוָה אֶל־משֶׁה לֵאמֹר';

          largeVerseTexts[book][String(chapter)][String(verse)] = {
            he: hebrewTexts,
            en: 'Sample text',
          };
        }
      }
    }

    buildSearchIndex(largeVerseTexts);
  });

  it('substring mode should complete in under 100ms for common word', () => {
    const start = performance.now();
    const results = search('אלהים', false, 'substring');
    const end = performance.now();
    const duration = end - start;

    expect(results.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100); // Should be fast
  });

  it('word mode should complete in under 100ms for common word', () => {
    const start = performance.now();
    const results = search('אלהים', false, 'word');
    const end = performance.now();
    const duration = end - start;

    expect(results.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100); // Should be fast
  });

  it('root mode should complete in under 50ms for common word', () => {
    // Root mode with inverted index should be FASTER than word mode
    // because it uses O(1) lookups instead of O(n) scans
    const start = performance.now();
    const results = search('אלהים', false, 'root');
    const end = performance.now();
    const duration = end - start;

    console.log(`Root mode search took ${duration.toFixed(2)}ms for ${results.length} results`);

    expect(results.length).toBeGreaterThan(0);
    // This will FAIL with current implementation (takes ~100-200ms)
    // After optimization with inverted index, should be < 50ms
    expect(duration).toBeLessThan(50);
  });

  it('multiple search terms in root mode should complete quickly', () => {
    const start = performance.now();
    const results = search('אלהים, יהוה', false, 'root');
    const end = performance.now();
    const duration = end - start;

    expect(results.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(75); // Slightly more time for multiple terms
  });
});
