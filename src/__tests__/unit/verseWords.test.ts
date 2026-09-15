// Splitting a verse into the words a reader can click.
//
// Word boundaries here must match the ones normalizeHebrewForSearch() uses,
// because the dictionary index was built on that rule. If the two drift, a
// click looks up a word the reader did not click.

import { describe, it, expect } from 'vitest';
import { splitVerseText, lookupForm } from '../../verseWords';

const words = (text: string) =>
  splitVerseText(text)
    .filter((p) => p.kind === 'word')
    .map((p) => p.text);

describe('splitting a verse', () => {
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

  it('marks {פ} and {ס} as markers rather than words', () => {
    const pieces = splitVerseText('אֶחָֽד׃ {פ}');

    expect(pieces.filter((p) => p.kind === 'word').map((p) => p.text)).toEqual(['אֶחָֽד']);
    expect(pieces.filter((p) => p.kind === 'marker').map((p) => p.text)).toEqual(['{פ}']);
  });

  it('keeps a parenthesised alternate as a word', () => {
    expect(words('(לא) אליו')).toEqual(['(לא)', 'אליו']);
  });

  it('reproduces the original text when the pieces are joined', () => {
    // Every later task rebuilds the verse from these pieces. Losing a
    // character here would silently corrupt the displayed text.
    const verse = 'וְהָאָ֗רֶץ הָיְתָ֥ה תֹ֙הוּ֙ וָבֹ֔הוּ עַל־פְּנֵ֣י תְה֑וֹם׃ {פ}';

    expect(
      splitVerseText(verse)
        .map((p) => p.text)
        .join(''),
    ).toBe(verse);
  });

  it('handles an empty verse without inventing a piece', () => {
    expect(splitVerseText('')).toEqual([]);
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
