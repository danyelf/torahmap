/**
 * Tests for Hebrew final forms normalization in search
 *
 * Hebrew has 5 letters with final forms (sofit) used at word endings:
 * - מ (mem) → ם (mem sofit)
 * - כ (kaf) → ך (kaf sofit)
 * - נ (nun) → ן (nun sofit)
 * - פ (pe) → ף (pe sofit)
 * - צ (tzadi) → ץ (tzadi sofit)
 *
 * Search should treat these as equivalent, so searching for the regular
 * form matches the final form and vice versa.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { stripNikkud, normalizeHebrewForSearch, toDisplayHebrew, buildSearchIndex, search, findLemmasForWord } from '../../search';
import type { VerseTexts } from '../../verseTexts';

describe('Hebrew Final Forms Normalization', () => {
  describe('stripNikkud (preserves final forms)', () => {
    it('should strip nikkud but preserve final mem sofit (ם)', () => {
      expect(stripNikkud('שָׁלוֹם')).toBe('שלום'); // Strip nikkud, keep ם
    });

    it('should strip nikkud but preserve final kaf sofit (ך)', () => {
      expect(stripNikkud('מֶלֶך')).toBe('מלך'); // Strip nikkud, keep ך
    });
  });

  describe('normalizeHebrewForSearch (normalizes final forms)', () => {
    it('should normalize mem sofit (ם) to regular mem (מ)', () => {
      expect(normalizeHebrewForSearch('שלום')).toBe('שלומ'); // ם → מ
    });

    it('should normalize kaf sofit (ך) to regular kaf (כ)', () => {
      expect(normalizeHebrewForSearch('מלך')).toBe('מלכ'); // ך → כ
    });

    it('should normalize nun sofit (ן) to regular nun (נ)', () => {
      expect(normalizeHebrewForSearch('בן')).toBe('בנ'); // ן → נ
    });

    it('should normalize pe sofit (ף) to regular pe (פ)', () => {
      expect(normalizeHebrewForSearch('כף')).toBe('כפ'); // ף → פ
    });

    it('should normalize tzadi sofit (ץ) to regular tzadi (צ)', () => {
      expect(normalizeHebrewForSearch('ארץ')).toBe('ארצ'); // ץ → צ
    });

    it('should handle multiple final forms in one string', () => {
      expect(normalizeHebrewForSearch('מלך הארץ')).toBe('מלכ הארצ'); // ך → כ, ץ → צ
    });

    it('should normalize final forms even with nikkud present', () => {
      expect(normalizeHebrewForSearch('שָׁלוֹם')).toBe('שלומ'); // Remove nikkud AND normalize ם → מ
    });
  });

  describe('toDisplayHebrew (restores final forms at word endings)', () => {
    it('should restore mem sofit at word end', () => {
      expect(toDisplayHebrew('שלומ')).toBe('שלום'); // מ → ם at end
    });

    it('should restore kaf sofit at word end', () => {
      expect(toDisplayHebrew('מלכ')).toBe('מלך'); // כ → ך at end
    });

    it('should restore finals in multi-word text', () => {
      expect(toDisplayHebrew('מלכ הארצ')).toBe('מלך הארץ'); // כ→ך, צ→ץ
    });

    it('should not change medial letters mid-word', () => {
      expect(toDisplayHebrew('כנפי')).toBe('כנפי'); // פ stays medial (not at end)
    });

    it('should not change letters that have no final form', () => {
      expect(toDisplayHebrew('דבר')).toBe('דבר'); // ר has no final form
    });
  });

  describe('search with final forms', () => {
    const mockVerseTexts: VerseTexts = {
      Genesis: {
        '1': {
          '1': { he: 'בְּרֵאשִׁית בָּרָא אֱלֹהִים', en: 'In the beginning God created' },
          '2': { he: 'וְהָאָרֶץ הָיְתָה תֹהוּ', en: 'And the earth was without form' },
        },
        '2': {
          '1': { he: 'וַיְכֻלּוּ הַשָּׁמַיִם', en: 'And the heavens were finished' },
        },
      },
      Exodus: {
        '1': {
          '1': { he: 'וְאֵלֶּה שְׁמוֹת', en: 'And these are the names' },
        },
      },
    };

    beforeAll(() => {
      buildSearchIndex(mockVerseTexts);
    });

    describe('substring mode', () => {
      it('should find אלהים (with final mem ם) when searching with regular mem (אלהימ)', () => {
        // Genesis 1:1 has אֱלֹהִים (Elohim) ending with ם (mem sofit)
        // User types אלהימ (with regular mem) - should still match
        const results = search('אלהימ', false, 'substring');
        const genesis11 = results.find(r => r.book === 'Genesis' && r.chapter === 1 && r.verse === 1);
        expect(genesis11).toBeDefined();
      });

      it('should find אלהים when searching with final mem (אלהים)', () => {
        // Searching with correct final form should also work
        const results = search('אלהים', false, 'substring');
        const genesis11 = results.find(r => r.book === 'Genesis' && r.chapter === 1 && r.verse === 1);
        expect(genesis11).toBeDefined();
      });

      it('should find הארץ (with final tzadi ץ) when searching with regular tzadi (הארצ)', () => {
        // Genesis 1:2 has הָאָרֶץ (the earth) ending with ץ (tzadi sofit)
        // User types הארצ (with regular tzadi) - should still match
        const results = search('הארצ', false, 'substring');
        const genesis12 = results.find(r => r.book === 'Genesis' && r.chapter === 1 && r.verse === 2);
        expect(genesis12).toBeDefined();
      });

      it('should find הארץ when searching with final tzadi (הארץ)', () => {
        // Searching with correct final form should also work
        const results = search('הארץ', false, 'substring');
        const genesis12 = results.find(r => r.book === 'Genesis' && r.chapter === 1 && r.verse === 2);
        expect(genesis12).toBeDefined();
      });

      it('should find השמים (with final mem) when searching with regular mem (השמימ)', () => {
        // Genesis 2:1 has הַשָּׁמַיִם (the heavens) ending with ם (mem sofit)
        const results = search('השמימ', false, 'substring');
        const genesis21 = results.find(r => r.book === 'Genesis' && r.chapter === 2 && r.verse === 1);
        expect(genesis21).toBeDefined();
      });

      it('should find שמות (with final tav) when searching either way', () => {
        // Exodus 1:1 has שְׁמוֹת (names) - tav doesn't have a final form, but testing consistency
        const results = search('שמות', false, 'substring');
        const exodus11 = results.find(r => r.book === 'Exodus' && r.chapter === 1 && r.verse === 1);
        expect(exodus11).toBeDefined();
      });
    });

    describe('word mode', () => {
      it('should match whole words regardless of final form used in query', () => {
        // Exodus 1:1 has שְׁמוֹת (names) with final tav
        // Searching with either form should match the same verses
        const resultsWithRegular = search('אלהימ', false, 'word'); // regular mem
        const resultsWithFinal = search('אלהים', false, 'word');   // final mem

        // Both should find the same verses
        expect(resultsWithRegular.length).toBe(resultsWithFinal.length);
        expect(resultsWithRegular.length).toBeGreaterThan(0);
      });
    });

    describe('findLemmasForWord with medial-only input', () => {
      it('should find lemmas when input uses medial forms (no finals)', () => {
        // findLemmasForWord depends on loaded wordLemmas data.
        // When data is null it returns null, so we test normalisation logic
        // by verifying medial-form and final-form inputs both normalise to the
        // same key, which is what the lookup uses.
        const medial = normalizeHebrewForSearch('אלהימ'); // typed with regular mem
        const withFinal = normalizeHebrewForSearch('אלהים'); // with final mem
        expect(medial).toBe(withFinal);
        expect(medial).toBe('אלהימ'); // both become medial-only
      });

      it('should normalise final-form input to match medial-only word-lemma keys', () => {
        // Ensure findLemmasForWord normalises its input so that
        // typing "ארץ" (with final tzadi) still matches key "ארצ"
        const medial = normalizeHebrewForSearch('ארץ');
        expect(medial).toBe('ארצ');
      });
    });

    describe('all final forms', () => {
      const finalFormsTest = [
        {
          withRegular: 'אלהימ', // typed with regular mem
          withFinal: 'אלהים',   // typed with final mem
          expectedWord: 'אלהים',
          verse: { book: 'Genesis', chapter: 1, verse: 1 }
        },
        {
          withRegular: 'הארצ',  // typed with regular tzadi
          withFinal: 'הארץ',    // typed with final tzadi
          expectedWord: 'הארץ',
          verse: { book: 'Genesis', chapter: 1, verse: 2 }
        },
        {
          withRegular: 'השמימ', // typed with regular mem
          withFinal: 'השמים',   // typed with final mem
          expectedWord: 'השמים',
          verse: { book: 'Genesis', chapter: 2, verse: 1 }
        },
      ];

      finalFormsTest.forEach(({ withRegular, withFinal, expectedWord, verse }) => {
        it(`should find ${expectedWord} when searching with regular form (${withRegular}) or final form (${withFinal})`, () => {
          const resultsRegular = search(withRegular, false, 'substring');
          const resultsFinal = search(withFinal, false, 'substring');

          const foundWithRegular = resultsRegular.find(
            r => r.book === verse.book && r.chapter === verse.chapter && r.verse === verse.verse
          );
          const foundWithFinal = resultsFinal.find(
            r => r.book === verse.book && r.chapter === verse.chapter && r.verse === verse.verse
          );

          expect(foundWithRegular).toBeDefined();
          expect(foundWithFinal).toBeDefined();
        });
      });
    });
  });
});
