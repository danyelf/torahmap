import { describe, it, expect } from 'vitest';
import { transliterate, TRANSLITERATION_MAP, HEBREW_TO_ENGLISH } from '../../hebrewTransliteration';

describe('hebrewTransliteration', () => {
  describe('TRANSLITERATION_MAP', () => {
    it('maps a to א (aleph)', () => {
      expect(TRANSLITERATION_MAP.a).toBe('\u05d0');
    });

    it('maps x to ש (shin)', () => {
      expect(TRANSLITERATION_MAP.x).toBe('\u05e9');
    });

    it('maps m to מ (mem)', () => {
      expect(TRANSLITERATION_MAP.m).toBe('\u05de');
    });

    it('maps phonetic consonants (23 letters)', () => {
      // Should have mappings for all consonants except i, o, u (vowels)
      const consonants = 'abcdefghjklmnpqrstvwxyz';
      for (const letter of consonants) {
        expect(TRANSLITERATION_MAP[letter]).toBeDefined();
        expect(typeof TRANSLITERATION_MAP[letter]).toBe('string');
      }
    });

    it('does not map vowel letters i, o, u', () => {
      expect(TRANSLITERATION_MAP.i).toBeUndefined();
      expect(TRANSLITERATION_MAP.o).toBeUndefined();
      expect(TRANSLITERATION_MAP.u).toBeUndefined();
    });

    it('maps Hebrew letters to valid Hebrew character range', () => {
      const hebrewRange = /[\u05D0-\u05EA]/;
      for (const letter in TRANSLITERATION_MAP) {
        expect(TRANSLITERATION_MAP[letter]).toMatch(hebrewRange);
      }
    });
  });

  describe('HEBREW_TO_ENGLISH', () => {
    it('maps א to a', () => {
      expect(HEBREW_TO_ENGLISH['\u05d0']).toBe('a');
    });

    it('maps ש to x', () => {
      expect(HEBREW_TO_ENGLISH['\u05e9']).toBe('x');
    });

    it('maps Hebrew letters back to English keys', () => {
      // Note: Due to duplicates (v/w→vav, p/f→pe),
      // reverse mapping returns first occurrence only
      for (const eng in TRANSLITERATION_MAP) {
        const heb = TRANSLITERATION_MAP[eng];
        expect(HEBREW_TO_ENGLISH[heb]).toBeDefined();
        expect(typeof HEBREW_TO_ENGLISH[heb]).toBe('string');
      }
    });
  });

  describe('transliterate', () => {
    it('transliterates single lowercase letter', () => {
      expect(transliterate('a')).toBe('\u05d0'); // a -> א (aleph)
    });

    it('transliterates single uppercase letter', () => {
      expect(transliterate('A')).toBe('\u05d0'); // A -> א (aleph)
    });

    it('transliterates "shalom" phonetically', () => {
      // "shalom" using phonetic transliteration:
      // x=ש (shin), l=ל (lamed), m=מ (mem)
      // But we don't have 'o' (vowel), so "shlm" -> שלמ
      expect(transliterate('xlm')).toBe('\u05e9\u05dc\u05de');
    });

    it('handles empty string', () => {
      expect(transliterate('')).toBe('');
    });

    it('preserves spaces', () => {
      expect(transliterate('a b')).toBe('\u05d0 \u05d1'); // a=א, b=ב
    });

    it('preserves non-alphabetic characters', () => {
      expect(transliterate('a1b2c3')).toBe('\u05d01\u05d12\u05e63'); // a=א, b=ב, c=צ
    });

    it('handles mixed case', () => {
      expect(transliterate('AbC')).toBe('\u05d0\u05d1\u05e6'); // A=א, b=ב, C=צ
    });

    it('preserves unmapped vowels i, o, u', () => {
      // s=ס, h=ה, a=א, l=ל, o=preserved, m=מ
      expect(transliterate('shalom')).toBe('\u05e1\u05d4\u05d0\u05dco\u05de');
    });
  });
});
