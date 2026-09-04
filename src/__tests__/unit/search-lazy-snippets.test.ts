// Tests for lazy snippet evaluation performance optimization
// tm-6mw3: Hebrew search performance improvement via lazy snippet computation
import { describe, it, expect, beforeEach } from 'vitest';
import {
  search,
  buildSearchIndex,
  computeSnippetForMatch,
  type SearchResult,
} from '../../search';
import type { VerseTexts } from '../../verseTexts';

describe('Lazy Snippet Evaluation', () => {
  let mockVerseTexts: VerseTexts;

  beforeEach(() => {
    // Setup test verse texts with Hebrew content
    mockVerseTexts = {
      'Genesis': {
        '1': {
          '1': {
            he: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם',
            en: 'In the beginning God created the heavens',
          },
          '2': {
            he: 'וְהָאָרֶץ הָיְתָה תֹהוּ וָבֹהוּ',
            en: 'And the earth was without form and void',
          },
          '3': {
            he: 'וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר',
            en: 'And God said let there be light',
          },
        },
        '2': {
          '7': {
            he: 'וַיִּיצֶר יְהוָה אֱלֹהִים אֶת־הָאָדָם',
            en: 'And the LORD God formed man',
          },
        },
        '12': {
          '1': {
            he: 'וַיֹּאמֶר יְהוָה אֶל־אַבְרָם',
            en: 'And the LORD said to Abram',
          },
        },
      },
    };

    buildSearchIndex(mockVerseTexts);
  });

  describe('SearchResult with optional snippet fields', () => {
    it('root mode search returns results without snippets initially', () => {
      // When searching in root mode (which falls back to whole-word without the lexeme index),
      // results should be returned WITHOUT snippet computation
      const results = search('אלהים', false, 'root');

      expect(results.length).toBeGreaterThan(0);
      const firstResult = results[0];

      expect(firstResult.matchingTerms.length).toBeGreaterThan(0);
      const firstMatch = firstResult.matchingTerms[0];

      // Snippet fields should be undefined (not computed yet)
      expect(firstMatch.snippet).toBeUndefined();
      expect(firstMatch.matchStart).toBeUndefined();
      expect(firstMatch.matchEnd).toBeUndefined();
    });

    it('computeSnippetForMatch creates snippet on-demand', () => {
      // Search without computing snippets
      const results = search('אלהים', false, 'root');
      expect(results.length).toBeGreaterThan(0);

      const result = results[0];
      const match = result.matchingTerms[0];

      // Initially no snippet
      expect(match.snippet).toBeUndefined();

      // Compute snippet on-demand
      const snippetData = computeSnippetForMatch(result, match.termIndex, 'אלהים');

      // Should return valid snippet data
      expect(snippetData).not.toBeNull();
      expect(snippetData!.snippet).toBeDefined();
      expect(snippetData!.matchStart).toBeGreaterThanOrEqual(0);
      expect(snippetData!.matchEnd).toBeGreaterThan(snippetData!.matchStart);
      expect(snippetData!.matchEnd).toBeLessThanOrEqual(snippetData!.snippet.length);

      // Snippet should contain Hebrew text
      expect(snippetData!.snippet).toMatch(/[\u0590-\u05FF]/);
    });

    it('computeSnippetForMatch handles verse not found', () => {
      // Create invalid result
      const invalidResult: SearchResult = {
        book: 'NonExistent',
        chapter: 999,
        verse: 999,
        language: 'he',
        matchingTerms: [{ termIndex: 0 }],
      };

      const snippetData = computeSnippetForMatch(invalidResult, 0, 'אלהים');

      // Should return null for non-existent verse
      expect(snippetData).toBeNull();
    });

    it('computeSnippetForMatch returns fallback for word not found in verse', () => {
      // Search for a word that exists
      const results = search('אלהים', false, 'root');
      expect(results.length).toBeGreaterThan(0);

      const result = results[0];

      // Try to compute snippet for a different word (won't match)
      const snippetData = computeSnippetForMatch(result, 0, 'xyz123');

      // Should return fallback snippet (no highlighting)
      expect(snippetData).not.toBeNull();
      expect(snippetData!.snippet).toBeDefined();
      expect(snippetData!.matchStart).toBe(0);
      expect(snippetData!.matchEnd).toBe(0);

      // Should contain Hebrew text from the verse
      expect(snippetData!.snippet).toMatch(/[\u0590-\u05FF]/);
    });

    it('computeSnippetForMatch highlights correct word position', () => {
      // Search for "אלהים" which appears in Genesis 1:1 and 1:3
      const results = search('אלהים', false, 'root');
      expect(results.length).toBeGreaterThanOrEqual(2);

      const gen11 = results.find(r => r.book === 'Genesis' && r.chapter === 1 && r.verse === 1);
      expect(gen11).toBeDefined();

      const match = gen11!.matchingTerms[0];
      const snippetData = computeSnippetForMatch(gen11!, match.termIndex, 'אלהים');

      expect(snippetData).not.toBeNull();

      // Extract highlighted portion
      const highlighted = snippetData!.snippet.slice(
        snippetData!.matchStart,
        snippetData!.matchEnd
      );

      // Should contain the base letters א, ל, ה, י, ם (may have nikkud)
      expect(highlighted).toMatch(/א.*ל.*ה.*י.*ם/);
    });
  });

  describe('Performance characteristics', () => {
    it('search returns quickly without snippet computation', () => {
      const startTime = performance.now();
      const results = search('אלהים', false, 'root');
      const searchTime = performance.now() - startTime;

      expect(results.length).toBeGreaterThan(0);

      // Search should be very fast (< 10ms for small dataset)
      expect(searchTime).toBeLessThan(10);

      // Verify snippets are not computed
      const firstMatch = results[0].matchingTerms[0];
      expect(firstMatch.snippet).toBeUndefined();
    });

    it('snippet computation is lazy per result', () => {
      // Get search results
      const results = search('אלהים', false, 'root');
      expect(results.length).toBeGreaterThan(0);

      // Compute snippet for first result only
      const firstResult = results[0];
      const firstMatch = firstResult.matchingTerms[0];

      const snippetData = computeSnippetForMatch(firstResult, firstMatch.termIndex, 'אלהים');
      expect(snippetData).not.toBeNull();

      // Only first result should have snippet data computed
      // Other results remain without snippets
      if (results.length > 1) {
        const secondMatch = results[1].matchingTerms[0];
        expect(secondMatch.snippet).toBeUndefined();
      }
    });
  });

  describe('Backward compatibility', () => {
    it('substring mode still returns snippets eagerly', () => {
      // Substring mode should continue to compute snippets eagerly
      const results = search('אלהים', false, 'substring');

      expect(results.length).toBeGreaterThan(0);
      const firstMatch = results[0].matchingTerms[0];

      // Snippet should be computed eagerly for substring mode
      expect(firstMatch.snippet).toBeDefined();
      expect(firstMatch.matchStart).toBeGreaterThanOrEqual(0);
      expect(firstMatch.matchEnd).toBeGreaterThan(firstMatch.matchStart!);
    });

    it('word mode still returns snippets eagerly', () => {
      // Word mode should continue to compute snippets eagerly
      const results = search('אלהים', false, 'word');

      expect(results.length).toBeGreaterThan(0);
      const firstMatch = results[0].matchingTerms[0];

      // Snippet should be computed eagerly for word mode
      expect(firstMatch.snippet).toBeDefined();
      expect(firstMatch.matchStart).toBeGreaterThanOrEqual(0);
      expect(firstMatch.matchEnd).toBeGreaterThan(firstMatch.matchStart!);
    });
  });

  describe('Multi-term search with lazy evaluation', () => {
    it('multiple matching terms have no snippets initially', () => {
      const results = search('אלהים, אדם', false, 'root');

      // Genesis 2:7 has both אלהים and אדם
      const gen27 = results.find(r => r.book === 'Genesis' && r.chapter === 2 && r.verse === 7);

      if (gen27 && gen27.matchingTerms.length > 1) {
        // Both terms should have no snippets initially
        for (const match of gen27.matchingTerms) {
          expect(match.snippet).toBeUndefined();
        }
      }
    });

    it('computes snippets independently for each term', () => {
      const results = search('אלהים, אדם', false, 'root');
      const gen27 = results.find(r => r.book === 'Genesis' && r.chapter === 2 && r.verse === 7);

      if (gen27 && gen27.matchingTerms.length > 1) {
        // Compute snippet for first term only
        const firstMatch = gen27.matchingTerms[0];
        const searchTerms = ['אלהים', 'אדם'];

        const snippet1 = computeSnippetForMatch(gen27, firstMatch.termIndex, searchTerms[firstMatch.termIndex]);
        expect(snippet1).not.toBeNull();

        // Second term still has no snippet
        const secondMatch = gen27.matchingTerms[1];
        expect(secondMatch.snippet).toBeUndefined();
      }
    });
  });
});
