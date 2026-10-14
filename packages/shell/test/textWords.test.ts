// Splitting an item's text into the words a reader can click.
//
// Word boundaries here must match the ones the dictionary index was built on,
// or a click looks up a word the reader did not click.

import { describe, it, expect } from 'vitest';
import { textWords } from '../src/textWords.ts';
import { stripNikkud } from '../src/hebrew.ts';

const words = (text: string) => textWords(text).map((w) => w.word);

describe("the words of an item's text", () => {
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
    expect(words('(לא) אליו')).toEqual(['לא', 'אליו']);
  });

  it('says where each word sits in the text', () => {
    const text = 'וְהָאָ֗רֶץ {פ} עַל־פְּנֵ֣י תְה֑וֹם׃';
    for (const { word, start, end } of textWords(text)) {
      expect(text.slice(start, end)).toBe(word);
    }
  });

  it('handles an empty text without inventing a word', () => {
    expect(textWords('')).toEqual([]);
  });
});

describe('the spelling a click looks up and puts in the search box', () => {
  it('is the word as printed, final letters and all, without points or brackets', () => {
    expect(textWords('(הוצא) [הַיְצֵא] [בָּא הָאָרֶץ]').map((w) => stripNikkud(w.word))).toEqual([
      'הוצא',
      'היצא',
      'בא',
      'הארץ',
    ]);
  });
});
