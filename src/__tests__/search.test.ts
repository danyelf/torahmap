import { describe, it, expect } from 'vitest';
import { stripNikkud, isHebrewQuery, getMatchingVerseKeys } from '../search';

describe('stripNikkud', () => {
  it('removes vowel marks from Hebrew text', () => {
    // בְּרֵאשִׁית with nikkud → בראשית without
    const withNikkud = 'בְּרֵאשִׁית';
    const result = stripNikkud(withNikkud);
    expect(result).toBe('בראשית');
  });

  it('preserves Hebrew letters', () => {
    const text = 'אבגדה';
    expect(stripNikkud(text)).toBe('אבגדה');
  });

  it('preserves maqaf (hyphen)', () => {
    // Maqaf (U+05BE) should be preserved
    const text = 'אֶת־הָאָרֶץ';
    const result = stripNikkud(text);
    expect(result).toContain('־');
  });

  it('handles empty string', () => {
    expect(stripNikkud('')).toBe('');
  });

  it('preserves English text', () => {
    expect(stripNikkud('hello')).toBe('hello');
  });

  it('handles mixed Hebrew and English', () => {
    const mixed = 'בְּרֵאשִׁית Genesis';
    const result = stripNikkud(mixed);
    expect(result).toContain('בראשית');
    expect(result).toContain('Genesis');
  });
});

describe('isHebrewQuery', () => {
  it('returns true for Hebrew text', () => {
    expect(isHebrewQuery('בראשית')).toBe(true);
    expect(isHebrewQuery('אלהים')).toBe(true);
  });

  it('returns false for English text', () => {
    expect(isHebrewQuery('genesis')).toBe(false);
    expect(isHebrewQuery('God')).toBe(false);
  });

  it('returns true for mixed text with Hebrew', () => {
    expect(isHebrewQuery('The word בראשית means')).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isHebrewQuery('')).toBe(false);
  });

  it('returns false for numbers and punctuation', () => {
    expect(isHebrewQuery('123')).toBe(false);
    expect(isHebrewQuery('!@#')).toBe(false);
  });

  it('detects Hebrew even with nikkud', () => {
    expect(isHebrewQuery('בְּרֵאשִׁית')).toBe(true);
  });
});

describe('getMatchingVerseKeys', () => {
  it('creates set of verse keys from results', () => {
    const results = [
      { book: 'Genesis', chapter: 1, verse: 1, language: 'he' as const, matchingTerms: [{ termIndex: 0, snippet: '', matchStart: 0, matchEnd: 0 }] },
      { book: 'Genesis', chapter: 1, verse: 2, language: 'he' as const, matchingTerms: [{ termIndex: 0, snippet: '', matchStart: 0, matchEnd: 0 }] },
    ];
    const keys = getMatchingVerseKeys(results);
    expect(keys.has('Genesis:1:1')).toBe(true);
    expect(keys.has('Genesis:1:2')).toBe(true);
    expect(keys.size).toBe(2);
  });

  it('handles empty results', () => {
    const keys = getMatchingVerseKeys([]);
    expect(keys.size).toBe(0);
  });

  it('returns unique keys even if called multiple times', () => {
    const results = [
      { book: 'Genesis', chapter: 1, verse: 1, language: 'he' as const, matchingTerms: [{ termIndex: 0, snippet: 'a', matchStart: 0, matchEnd: 0 }] },
    ];
    const keys = getMatchingVerseKeys(results);
    expect(keys.size).toBe(1);
    expect(keys.has('Genesis:1:1')).toBe(true);
  });
});
