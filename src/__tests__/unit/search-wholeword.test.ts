// Tests for whole-word search functionality
import { describe, it, expect, beforeEach } from 'vitest';
import { search, buildSearchIndex, parseSearchTerms } from '../../search';
import type { VerseTexts } from '../../verseTexts';

describe('Whole Word Search', () => {
  let mockVerseTexts: VerseTexts;

  beforeEach(() => {
    // Setup test verse texts with specific words that can test substring vs whole-word
    mockVerseTexts = {
      'Genesis': {
        '1': {
          '1': {
            he: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים',
            en: 'In the beginning God created the heavens',
          },
          '2': {
            he: 'וְהָאָרֶץ הָיְתָה תֹהוּ',
            en: 'And the earth was without form and void',
          },
          '3': {
            he: 'וַיֹּאמֶר אֱלֹהִים יְהִי אוֹר',
            en: 'God said let there be light',
          },
        },
        '2': {
          '1': {
            he: 'וַיְכֻלּוּ הַשָּׁמַיִם',
            en: 'The heavens were finished',
          },
        },
      },
      'Exodus': {
        '1': {
          '1': {
            he: 'וְאֵלֶּה שְׁמוֹת',
            en: 'Now these are the names of Israel',
          },
          '2': {
            he: 'רְאוּבֵן שִׁמְעוֹן',
            en: 'Reuben and Simeon',
          },
        },
      },
    };

    buildSearchIndex(mockVerseTexts);
  });

  describe('English substring vs whole-word', () => {
    it('substring search (default): finds "heaven" in "heavens"', () => {
      const results = search('heaven', false); // substring search
      expect(results.length).toBeGreaterThan(0);

      // Should match both "heavens" (Gen 1:1) and "heavens" (Gen 2:1)
      const genesisMatches = results.filter(r => r.book === 'Genesis');
      expect(genesisMatches.length).toBe(2);
    });

    it('whole-word search: does NOT find "heaven" in "heavens"', () => {
      const results = search('heaven', true); // whole-word search

      // Should NOT match "heavens" since we want exact word "heaven"
      expect(results.length).toBe(0);
    });

    it('whole-word search: finds "heavens" as a whole word', () => {
      const results = search('heavens', true); // whole-word search
      expect(results.length).toBeGreaterThan(0);

      // Should match "heavens" in Gen 1:1 and Gen 2:1
      const genesisMatches = results.filter(r => r.book === 'Genesis');
      expect(genesisMatches.length).toBe(2);
    });

    it('substring search: finds "the" in "these" and "the"', () => {
      const results = search('the', false);
      expect(results.length).toBeGreaterThan(0);

      // Should match all verses containing "the" substring
      // Including "the", "these", "there"
      expect(results.length).toBeGreaterThanOrEqual(4);
    });

    it('whole-word search: matches fewer verses than substring', () => {
      const substringResults = search('the', false);
      const wholeWordResults = search('the', true);

      // Whole-word should match fewer or equal verses
      // (only standalone "the", not within other words)
      expect(wholeWordResults.length).toBeLessThanOrEqual(substringResults.length);

      // But should still find some matches
      expect(wholeWordResults.length).toBeGreaterThan(0);
    });

    it('whole-word search: handles word boundaries with punctuation', () => {
      const results = search('God', true);

      // Should match "God" even when followed by punctuation
      const matches = results.filter(r => r.book === 'Genesis');
      expect(matches.length).toBeGreaterThan(0);
    });

    it('whole-word search: case insensitive', () => {
      const lowerResults = search('god', true);
      const upperResults = search('GOD', true);
      const mixedResults = search('God', true);

      // All should return same results (case insensitive)
      expect(lowerResults.length).toBe(upperResults.length);
      expect(lowerResults.length).toBe(mixedResults.length);
    });

    it('substring vs whole-word: clear difference with "ear" (earth vs ear)', () => {
      // Substring should find "earth" (contains "ear")
      const substringResults = search('ear', false);
      const earthMatches = substringResults.filter(r =>
        r.book === 'Genesis' && r.chapter === 1 && r.verse === 2
      );
      expect(earthMatches.length).toBe(1); // "earth" contains "ear"

      // Whole-word should NOT find "earth" when searching for "ear"
      const wholeWordResults = search('ear', true);
      const earthMatchesWW = wholeWordResults.filter(r =>
        r.book === 'Genesis' && r.chapter === 1 && r.verse === 2
      );
      expect(earthMatchesWW.length).toBe(0); // "earth" is not "ear"
    });
  });

  describe('Hebrew search ignores whole-word setting', () => {
    it('Hebrew search uses lemma-based search regardless of whole-word', () => {
      // Hebrew should use lemma-based search and ignore whole-word parameter
      const resultsWithoutWW = search('אלהים', false);
      const resultsWithWW = search('אלהים', true);

      // Should return same results for Hebrew regardless of whole-word setting
      expect(resultsWithWW.length).toBe(resultsWithoutWW.length);
    });
  });

  describe('Multi-term search with whole-word', () => {
    it('applies whole-word to all terms', () => {
      const results = search('the, heaven', true);

      // Should find verses with "the" or "heaven" as whole words
      // but NOT "heavens" or "these"
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
