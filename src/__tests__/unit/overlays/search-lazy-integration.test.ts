// Integration tests for lazy snippet evaluation in search overlay
// tm-6mw3: Verify UI properly computes snippets on-demand
import { describe, it, expect, beforeEach } from 'vitest';
import { search, buildSearchIndex, computeSnippetForMatch } from '../../../search';
import type { VerseTexts } from '../../../verseTexts';

describe('Search Overlay - Lazy Snippet Integration', () => {
  let mockVerseTexts: VerseTexts;

  beforeEach(() => {
    mockVerseTexts = {
      'Genesis': {
        '1': {
          '1': {
            he: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם',
            en: 'In the beginning God created the heavens',
          },
          '3': {
            he: 'וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר',
            en: 'And God said let there be light',
          },
        },
      },
    };

    buildSearchIndex(mockVerseTexts);
  });

  it('root mode returns results without snippets, UI computes on-demand', () => {
    // Simulate what the UI does:
    // 1. Search returns results (root mode - lazy)
    const results = search('אלהים', false, 'root');

    expect(results.length).toBeGreaterThan(0);
    const firstResult = results[0];
    const firstMatch = firstResult.matchingTerms[0];

    // 2. UI checks if snippet exists - it doesn't
    expect(firstMatch.snippet).toBeUndefined();

    // 3. UI computes snippet on-demand for display
    const snippetData = computeSnippetForMatch(firstResult, firstMatch.termIndex, 'אלהים');

    expect(snippetData).not.toBeNull();
    expect(snippetData!.snippet).toBeDefined();
    expect(snippetData!.matchStart).toBeGreaterThanOrEqual(0);
    expect(snippetData!.matchEnd).toBeGreaterThan(snippetData!.matchStart);

    // Verify snippet contains the search term (with nikkud)
    expect(snippetData!.snippet).toMatch(/א.*ל.*ה.*י.*ם/);
  });

  it('computes snippets only for displayed results (not all 2000+ results)', () => {
    // Search that returns many results
    const results = search('אלהים', false, 'root');

    // Simulate UI showing first 10 results only
    const displayResults = results.slice(0, 10);

    // All results should have NO snippets initially
    for (const result of results) {
      expect(result.matchingTerms[0].snippet).toBeUndefined();
    }

    // Compute snippets only for displayed results
    const computedSnippets = displayResults.map(result => {
      const match = result.matchingTerms[0];
      return computeSnippetForMatch(result, match.termIndex, 'אלהים');
    });

    // Verify only 10 snippets computed
    expect(computedSnippets.length).toBe(Math.min(10, results.length));
    expect(computedSnippets.every(s => s !== null)).toBe(true);

    // Verify remaining results still have no snippets
    for (let i = 10; i < results.length; i++) {
      expect(results[i].matchingTerms[0].snippet).toBeUndefined();
    }
  });

  it('substring/word modes still have snippets computed eagerly', () => {
    // These modes should continue working as before
    const substringResults = search('אלהים', false, 'substring');
    const wordResults = search('אלהים', false, 'word');

    expect(substringResults.length).toBeGreaterThan(0);
    expect(wordResults.length).toBeGreaterThan(0);

    // Both should have snippets already computed
    expect(substringResults[0].matchingTerms[0].snippet).toBeDefined();
    expect(wordResults[0].matchingTerms[0].snippet).toBeDefined();
  });
});
