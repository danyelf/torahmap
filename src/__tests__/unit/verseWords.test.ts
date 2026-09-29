// Splitting a verse into the words a reader can click.
//
// Word boundaries here are the ones normalizeHebrewForSearch() uses, because
// the dictionary index was built on that rule. If the two drift, a click looks
// up a word the reader did not click.

import { describe, it, expect } from 'vitest';
import { verseWords, lookupForm } from '../../verseWords';

const words = (text: string) => verseWords(text).map((w) => w.word);

describe('the words of a verse', () => {
  it('splits on spaces', () => {
    expect(words('בראשית ברא אלהים')).toEqual(['בראשית', 'ברא', 'אלהים']);
  });

  it('treats maqaf as a separator, so על־פני is two clickable words', () => {
    // The dictionary index does the same, and a maqaf-joined pair is two
    // dictionary words. Clicking should reach whichever one was hit.
    expect(words('עַל־פְּנֵי')).toEqual(['עַל', 'פְּנֵי']);
  });

  it('keeps points and accents on the word, since they are what is displayed', () => {
    expect(words('בְּרֵאשִׁ֖ית')).toEqual(['בְּרֵאשִׁ֖ית']);
  });

  it('leaves out {פ} and {ס}', () => {
    expect(words('אֶחָֽד׃ {פ} שנים {ס}')).toEqual(['אֶחָֽד', 'שנים']);
  });

  it('leaves out a single letter, and a piece with no letter at all', () => {
    expect(words('הַ ] — אֶחָֽד')).toEqual(['אֶחָֽד']);
  });

  it('keeps a parenthesised alternate as a word', () => {
    expect(words('(לא) אליו')).toEqual(['(לא)', 'אליו']);
  });

  it('says where each word sits in the verse', () => {
    const verse = 'וְהָאָ֗רֶץ {פ} עַל־פְּנֵ֣י תְה֑וֹם׃';
    for (const { word, start, end } of verseWords(verse)) {
      expect(verse.slice(start, end)).toBe(word);
    }
  });

  it('handles an empty verse without inventing a word', () => {
    expect(verseWords('')).toEqual([]);
  });
});

describe('the spelling a click looks up', () => {
  it('leaves an ordinary word alone, apart from its points', () => {
    expect(lookupForm('בְּרֵאשִׁ֖ית')).toBe('בראשית');
  });

  it('drops the parentheses around the written form of a variant', () => {
    expect(lookupForm('(הוצא)')).toBe('הוצא');
  });

  it('drops the square brackets around the form that is actually read', () => {
    // Sefaria writes a textual variant as a pair, the written form in
    // parentheses and the spoken one in square brackets. Both kinds of bracket
    // are punctuation the verse displays, not letters of the word, and no
    // dictionary key carries either.
    expect(lookupForm('[הַיְצֵ֣א]')).toBe('היצא');
  });

  it('does not treat a stray bracket as a wrapper', () => {
    expect(lookupForm('(הוצא')).toBe('(הוצא');
  });
});
