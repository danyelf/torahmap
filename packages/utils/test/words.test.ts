import { describe, it, expect } from 'vitest';
import { isSearchableWord } from '../src/index.ts';

describe('a word search deals in', () => {
  it('has at least two letters', () => {
    expect(isSearchableWord('אב')).toBe(true);
    expect(isSearchableWord('ab')).toBe(true);
    expect(isSearchableWord('א')).toBe(false);
    expect(isSearchableWord('a')).toBe(false);
  });

  it('does not count points or punctuation as letters', () => {
    expect(isSearchableWord('הַ')).toBe(false);
    expect(isSearchableWord(']')).toBe(false);
    expect(isSearchableWord('—')).toBe(false);
    expect(isSearchableWord('(לא)')).toBe(true);
  });
});
