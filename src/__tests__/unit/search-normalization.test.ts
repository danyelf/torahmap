import { describe, it, expect, beforeAll } from 'vitest';
import { normalizeHebrewForSearch, findLexemesForWord } from '../../search';
import { loadLexiconData } from '../../search';

describe('the combining grapheme joiner', () => {
  it('is removed, so Jerusalem normalizes to the same word with or without it', () => {
    const withJoiner = 'ירושל͏ם';
    const withoutJoiner = 'ירושלם';

    expect(normalizeHebrewForSearch(withJoiner)).toBe(normalizeHebrewForSearch(withoutJoiner));
  });

  it('leaves the word findable in the dictionary', async () => {
    await loadLexiconData();

    expect(findLexemesForWord(normalizeHebrewForSearch('ירושל͏ם'))).not.toBeNull();
  });
});
