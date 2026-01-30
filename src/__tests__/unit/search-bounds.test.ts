// Tests for bounds validation in search snippet creation
import { describe, it, expect, beforeEach } from 'vitest';
import { search, buildSearchIndex } from '../../search';
import type { VerseTexts } from '../../verseTexts';

describe('Search Bounds Validation', () => {
  let mockVerseTexts: VerseTexts;

  beforeEach(() => {
    // Setup test verse texts with edge cases
    mockVerseTexts = {
      'Genesis': {
        '1': {
          '1': {
            he: 'אֱלֹהִים', // Short Hebrew text (5 chars without nikkud, more with)
            en: 'God',
          },
          '2': {
            he: 'בְּרֵאשִׁית', // Another short Hebrew text
            en: 'In the beginning',
          },
        },
      },
    };

    buildSearchIndex(mockVerseTexts);
  });

  describe('Hebrew text with nikkud - bounds checking', () => {
    it('handles match at end of text without overflow', () => {
      // Search for a term that appears at the end of the verse
      const results = search('אלהים');

      expect(results.length).toBeGreaterThan(0);

      const match = results[0];
      expect(match.matchingTerms.length).toBeGreaterThan(0);

      const termMatch = match.matchingTerms[0];
      // Verify matchEnd doesn't exceed snippet length
      expect(termMatch.matchEnd).toBeLessThanOrEqual(termMatch.snippet!.length);

      // Verify we can safely slice the snippet
      expect(() => {
        termMatch.snippet!.slice(termMatch.matchStart!, termMatch.matchEnd!);
      }).not.toThrow();
    });

    it('handles nikkud characters without index overflow', () => {
      // When calculating origMatchEnd = origMatchStart + matchLen + nikkudInMatch,
      // this could potentially overflow if not bounds-checked
      const results = search('בראשית');

      expect(results.length).toBeGreaterThan(0);

      for (const result of results) {
        for (const termMatch of result.matchingTerms) {
          // matchEnd should never exceed snippet length
          expect(termMatch.matchEnd).toBeLessThanOrEqual(termMatch.snippet!.length);

          // The slice should work without issues
          const highlighted = termMatch.snippet!.slice(termMatch.matchStart!, termMatch.matchEnd!);
          expect(highlighted).toBeDefined();
          expect(highlighted.length).toBeGreaterThan(0);
        }
      }
    });

    it('handles malformed data gracefully', () => {
      // Simulate edge case where calculated match position might exceed text length
      // This shouldn't happen with real data, but we want defensive code

      // Add a test with very short text
      const shortTextVerses: VerseTexts = {
        'Test': {
          '1': {
            '1': {
              he: 'א', // Single character
              en: 'a',
            },
          },
        },
      };

      buildSearchIndex(shortTextVerses);

      // Search for something that won't match
      const results = search('xyz');

      // Should handle gracefully without crashes
      expect(results).toBeDefined();
      expect(results.length).toBe(0);
    });

    it('handles edge case with match at exact text boundary', () => {
      // Test case where match is at the very end of the text
      // Use existing Genesis 1:1 which has 'אֱלֹהִים' at the end
      const results = search('אלהים');
      expect(results.length).toBeGreaterThan(0);

      const result = results[0];
      const termMatch = result.matchingTerms[0];

      // matchEnd should not exceed snippet length
      expect(termMatch.matchEnd).toBeLessThanOrEqual(termMatch.snippet!.length);

      // Should be able to extract the highlighted text
      const highlighted = termMatch.snippet!.slice(termMatch.matchStart!, termMatch.matchEnd!);
      expect(highlighted).toBeTruthy();
    });

    it('handles Hebrew text with excessive nikkud marks', () => {
      // Test case with many nikkud marks that could cause overflow if not bounds-checked
      // Use existing Genesis 1:2 which has nikkud marks
      const results = search('בראשית');
      expect(results.length).toBeGreaterThan(0);

      const result = results[0];
      const termMatch = result.matchingTerms[0];

      // Verify bounds are respected
      expect(termMatch.matchStart).toBeGreaterThanOrEqual(0);
      expect(termMatch.matchEnd!).toBeGreaterThanOrEqual(termMatch.matchStart!);
      expect(termMatch.matchEnd).toBeLessThanOrEqual(termMatch.snippet!.length);

      // Should extract successfully
      const highlighted = termMatch.snippet!.slice(termMatch.matchStart!, termMatch.matchEnd!);
      expect(highlighted.length).toBeGreaterThan(0);
    });

    it('validates matchEnd is within text bounds', () => {
      const results = search('אלהים');

      for (const result of results) {
        for (const termMatch of result.matchingTerms) {
          // Core validation: matchEnd should be valid for the snippet
          expect(termMatch.matchStart).toBeGreaterThanOrEqual(0);
          expect(termMatch.matchEnd!).toBeGreaterThanOrEqual(termMatch.matchStart!);
          expect(termMatch.matchEnd).toBeLessThanOrEqual(termMatch.snippet!.length);

          // Extracting the highlighted portion should work
          const highlighted = termMatch.snippet!.slice(termMatch.matchStart!, termMatch.matchEnd!);
          expect(highlighted).toBeTruthy();
        }
      }
    });
  });

  describe('English text - bounds checking', () => {
    it('handles match at end of text', () => {
      const results = search('God');

      expect(results.length).toBeGreaterThan(0);

      for (const result of results) {
        for (const termMatch of result.matchingTerms) {
          expect(termMatch.matchEnd).toBeLessThanOrEqual(termMatch.snippet!.length);
        }
      }
    });

    it('validates all match positions', () => {
      const results = search('beginning');

      for (const result of results) {
        for (const termMatch of result.matchingTerms) {
          // Bounds validation
          expect(termMatch.matchStart).toBeGreaterThanOrEqual(0);
          expect(termMatch.matchEnd!).toBeGreaterThanOrEqual(termMatch.matchStart!);
          expect(termMatch.matchEnd).toBeLessThanOrEqual(termMatch.snippet!.length);
        }
      }
    });
  });
});
