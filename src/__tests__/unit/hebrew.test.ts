// One rule decides where a word ends, so the three readers of Hebrew text
// agree. These are the cases where they used to disagree.

import { describe, it, expect } from 'vitest';
import {
  isWordSeparator,
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
