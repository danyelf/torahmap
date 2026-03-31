// Performance regression tests for Hebrew search
// tm-6mw3: Ensure search performance meets acceptable thresholds
import { describe, it, expect, beforeAll } from 'vitest';
import { search, buildSearchIndex } from '../../search';
import type { VerseTexts } from '../../verseTexts';
import { seededRandom } from '../../utils/random';

describe('Search Performance', () => {
  // Use beforeAll — building a 23k-verse index once is enough,
  // and avoids re-indexing overhead contaminating each test's timing.
  beforeAll(() => {
    const largeVerseTexts: VerseTexts = {};
    const books = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'];
    const versesPerBook = 4600; // 23,000 / 5
    let seed = 0;

    for (const book of books) {
      largeVerseTexts[book] = {};
      const chaptersInBook = 50;
      const versesPerChapter = Math.ceil(versesPerBook / chaptersInBook);

      for (let chapter = 1; chapter <= chaptersInBook; chapter++) {
        largeVerseTexts[book][String(chapter)] = {};

        for (let verse = 1; verse <= versesPerChapter; verse++) {
          // Deterministic: use seededRandom instead of Math.random
          const hasGod = seededRandom(seed++) > 0.5;
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

    // Warmup: JIT-compile the search path before measuring
    search('אלהים', false, 'substring');
    search('אלהים', false, 'root');
  });

  it('substring mode should complete in under 200ms for common word', () => {
    const start = performance.now();
    const results = search('אלהים', false, 'substring');
    const duration = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(200);
  });

  it('word mode should complete in under 200ms for common word', () => {
    const start = performance.now();
    const results = search('אלהים', false, 'word');
    const duration = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(200);
  });

  it('root mode should complete in under 200ms for common word', () => {
    const start = performance.now();
    const results = search('אלהים', false, 'root');
    const duration = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(200);
  });

  it('multiple search terms in root mode should complete in under 200ms', () => {
    const start = performance.now();
    const results = search('אלהים, יהוה', false, 'root');
    const duration = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(200);
  });
});
