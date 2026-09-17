// One rule decides where a word ends, so the three readers of Hebrew text
// agree. These are the cases where they used to disagree.

import { describe, it, expect } from 'vitest';
import {
  isWordSeparator,
  mapStrippedToOriginal,
  splitIntoWords,
  stripNikkud,
  normalizeHebrewForSearch,
} from '../../hebrew';

const GENESIS_1_1_END = 'אֵ֥ת הַשָּׁמַ֖יִם וְאֵ֥ת הָאָֽרֶץ׃';

describe('where a word ends', () => {
  it('breaks on the four Hebrew separators, not only on space and maqaf', () => {
    expect(isWordSeparator('־')).toBe(true); // maqaf
    expect(isWordSeparator('׀')).toBe(true); // paseq
    expect(isWordSeparator('׃')).toBe(true); // sof pasuq
    expect(isWordSeparator('׆')).toBe(true); // nun hafukha
    expect(isWordSeparator('ָ')).toBe(false); // qamats is a point
    expect(isWordSeparator('א')).toBe(false);
  });

  it('does not leave the sof pasuq attached to the last word of a verse', () => {
    const words = splitIntoWords(stripNikkud(GENESIS_1_1_END));
    expect(words.map((w) => w.word)).toEqual(['את', 'השמים', 'ואת', 'הארץ']);
  });

  it('splits a maqaf-joined pair into two words', () => {
    expect(splitIntoWords('את־יצחק').map((w) => w.word)).toEqual(['את', 'יצחק']);
  });

  it('reports positions in the text it was given', () => {
    const [first, second] = splitIntoWords('אב גד');
    expect([first.start, first.end]).toEqual([0, 2]);
    expect([second.start, second.end]).toEqual([3, 5]);
  });
});

describe('the grapheme joiner Sefaria writes inside Jerusalem', () => {
  // U+034F renders as nothing and nobody types it. Stripping it without also
  // counting it when a position is mapped back would shift every mark after it.
  const JERUSALEM = 'יְרוּשָׁלַ֗͏ִם';

  it('is dropped along with the points', () => {
    expect(stripNikkud(JERUSALEM)).toBe('ירושלם');
    expect(normalizeHebrewForSearch(JERUSALEM)).toBe('ירושלמ');
  });

  it('is counted when a position past it is mapped back', () => {
    // The word after Jerusalem is what catches a mapping that has drifted: a
    // joiner dropped but not counted leaves every later position short by one.
    const text = `${JERUSALEM} שָׁלוֹם`;
    const at = stripNikkud(text).indexOf('שלום');

    expect(stripNikkud(text.slice(mapStrippedToOriginal(text, at)))).toBe('שלום');
  });
});

describe('folding a written form to its indexed spelling', () => {
  it('keeps final forms when only points are stripped', () => {
    expect(stripNikkud('שָׁלוֹם')).toBe('שלום');
  });

  it('folds final forms and separators for search', () => {
    expect(normalizeHebrewForSearch('שלום')).toBe('שלומ');
    expect(normalizeHebrewForSearch('את־יצחק')).toBe('את יצחק');
  });

  it('leaves whitespace as written rather than rewriting it as a space', () => {
    expect(normalizeHebrewForSearch('אב\nגד')).toBe('אב\nגד');
  });
});
