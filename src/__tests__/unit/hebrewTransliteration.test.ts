import { describe, it, expect } from 'vitest';
import { transliterate, TRANSLITERATION_MAP, HEBREW_TO_ENGLISH } from '../../hebrewTransliteration';

describe('hebrewTransliteration', () => {
  describe('TRANSLITERATION_MAP', () => {
    it('maps e to ק (qof)', () => {
      expect(TRANSLITERATION_MAP.e).toBe('\u05e7');
    });

    it('maps r to ר (resh)', () => {
      expect(TRANSLITERATION_MAP.r).toBe('\u05e8');
    });

    it('maps t to א (aleph)', () => {
      expect(TRANSLITERATION_MAP.t).toBe('\u05d0');
    });

    it('maps all 26 English letters', () => {
      const englishLetters = 'abcdefghijklmnopqrstuvwxyz';
      for (const letter of englishLetters) {
        expect(TRANSLITERATION_MAP[letter]).toBeDefined();
        expect(typeof TRANSLITERATION_MAP[letter]).toBe('string');
      }
    });

    it('maps Hebrew letters to valid Hebrew character range', () => {
      const hebrewRange = /[\u05D0-\u05EA]/;
      // Skip q and w which map to punctuation in the Hebrew keyboard layout
      const hebrewLetterKeys = 'ertyuiopasdfghjklzxcvbnm';
      for (const letter of hebrewLetterKeys) {
        expect(TRANSLITERATION_MAP[letter]).toMatch(hebrewRange);
      }
    });
  });

  describe('HEBREW_TO_ENGLISH', () => {
    it('maps ק to e', () => {
      expect(HEBREW_TO_ENGLISH['\u05e7']).toBe('e');
    });

    it('maps ר to r', () => {
      expect(HEBREW_TO_ENGLISH['\u05e8']).toBe('r');
    });

    it('is the inverse of TRANSLITERATION_MAP', () => {
      for (const eng in TRANSLITERATION_MAP) {
        const heb = TRANSLITERATION_MAP[eng];
        expect(HEBREW_TO_ENGLISH[heb]).toBe(eng);
      }
    });
  });

  describe('transliterate', () => {
    it('transliterates single lowercase letter', () => {
      expect(transliterate('e')).toBe('\u05e7'); // e -> ק (qof)
    });

    it('transliterates single uppercase letter', () => {
      expect(transliterate('E')).toBe('\u05e7'); // E -> ק (qof)
    });

    it('transliterates multiple letters', () => {
      // "shalom" using Hebrew keyboard layout:
      // a=ש (shin), v=ה (he), k=ל (lamed), u=ו (vav), o=ם (final mem)
      expect(transliterate('avkuo')).toBe('\u05e9\u05d4\u05dc\u05d5\u05dd');
    });

    it('handles empty string', () => {
      expect(transliterate('')).toBe('');
    });

    it('preserves spaces', () => {
      expect(transliterate('a b')).toBe('\u05e9 \u05e0'); // a=ש, b=נ
    });

    it('preserves non-alphabetic characters', () => {
      expect(transliterate('a1b2c3')).toBe('\u05e91\u05e02\u05d13'); // a=ש, b=נ, c=ב
    });

    it('handles mixed case', () => {
      expect(transliterate('AbC')).toBe('\u05e9\u05e0\u05d1'); // A=ש, b=נ, C=ב
    });
  });
});
