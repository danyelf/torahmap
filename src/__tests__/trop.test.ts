import { describe, it, expect } from 'vitest';
import {
  extractTropMarks,
  countTropMarks,
  getRarityTier,
  TROP_MARKS,
  TROP_BY_UNICODE,
} from '../trop';

describe('extractTropMarks', () => {
  it('extracts tipcha from Hebrew text', () => {
    // בְּרֵאשִׁ֖ית contains tipcha (U+0596)
    const text = 'בְּרֵאשִׁ֖ית';
    const marks = extractTropMarks(text);
    expect(marks).toContain('\u0596');
  });

  it('extracts multiple marks from text', () => {
    // Text with etnachta and tipcha
    const text = 'אֱלֹהִ֑ים בְּרֵאשִׁ֖ית';
    const marks = extractTropMarks(text);
    expect(marks.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array for text without trop', () => {
    const text = 'hello world';
    const marks = extractTropMarks(text);
    expect(marks).toEqual([]);
  });

  it('extracts only cantillation marks, not vowels', () => {
    // בְּ has nikkud (vowel marks) but no trop
    const text = 'בְּ';
    const marks = extractTropMarks(text);
    // Nikkud is in the range but outside trop (0x05B0-0x05BD are vowels)
    // Trop marks are 0x0591-0x05AF
    expect(marks.every(m => {
      const cp = m.codePointAt(0)!;
      return cp >= 0x0591 && cp <= 0x05AF;
    })).toBe(true);
  });
});

describe('countTropMarks', () => {
  it('counts occurrences of each mark', () => {
    // Create text with multiple instances of same mark
    const tipcha = '\u0596';
    const text = `א${tipcha}ב${tipcha}ג`;
    const counts = countTropMarks(text);
    expect(counts.get(tipcha)).toBe(2);
  });

  it('returns empty map for text without marks', () => {
    const counts = countTropMarks('plain text');
    expect(counts.size).toBe(0);
  });
});

describe('getRarityTier', () => {
  it('classifies rare marks correctly', () => {
    expect(getRarityTier(10)).toBe('rare');
    expect(getRarityTier(49)).toBe('rare');
  });

  it('classifies uncommon marks correctly', () => {
    expect(getRarityTier(50)).toBe('uncommon');
    expect(getRarityTier(200)).toBe('uncommon');
    expect(getRarityTier(499)).toBe('uncommon');
  });

  it('classifies common marks correctly', () => {
    expect(getRarityTier(500)).toBe('common');
    expect(getRarityTier(1000)).toBe('common');
    expect(getRarityTier(10000)).toBe('common');
  });

  it('handles boundary values', () => {
    expect(getRarityTier(49)).toBe('rare');
    expect(getRarityTier(50)).toBe('uncommon');
    expect(getRarityTier(499)).toBe('uncommon');
    expect(getRarityTier(500)).toBe('common');
  });
});

describe('TROP_MARKS constant', () => {
  it('contains expected number of marks', () => {
    // Should have all cantillation marks
    expect(TROP_MARKS.length).toBeGreaterThan(20);
  });

  it('each mark has required properties', () => {
    for (const mark of TROP_MARKS) {
      expect(mark.unicode).toBeDefined();
      expect(mark.codePoint).toBeGreaterThanOrEqual(0x0591);
      expect(mark.codePoint).toBeLessThanOrEqual(0x05AF);
      expect(mark.name).toBeDefined();
      expect(mark.hebrewName).toBeDefined();
    }
  });
});

describe('TROP_BY_UNICODE lookup', () => {
  it('can look up marks by unicode character', () => {
    const tipcha = TROP_BY_UNICODE.get('\u0596');
    expect(tipcha).toBeDefined();
    expect(tipcha?.name).toBe('Tipcha');
  });

  it('returns undefined for non-trop characters', () => {
    expect(TROP_BY_UNICODE.get('a')).toBeUndefined();
  });
});
