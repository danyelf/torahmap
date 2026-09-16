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

describe('shin and sin written as one character', () => {
  it('folds to the plain letter, so both spellings of a word agree', () => {
    // BHSA writes some words with U+FB2A/U+FB2B, where Sefaria writes the
    // plain letter and a dot that is stripped as a point. Without this the two
    // sources spell the same word differently and neither can find the other.
    expect(normalizeHebrewForSearch('שׁלום')).toBe(normalizeHebrewForSearch('שָׁלוֹם'));
    expect(normalizeHebrewForSearch('שׂמח')).toBe(normalizeHebrewForSearch('שָׂמַח'));
  });
});
