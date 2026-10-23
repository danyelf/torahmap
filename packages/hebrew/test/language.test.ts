import { describe, expect, it } from 'vitest';
import { hebrew, hebrewOrEnglish } from '../src/index.ts';

const PREFIXES = 'דולבכשמה';

/** The stretches of `text` where `term` stands as whole words. */
function words(language: ReturnType<typeof hebrew>, text: string, term: string): string[] {
  return language
    .wholeWords(language.fold(text), language.fold(term), Infinity)
    .map((r) => text.slice(r.start, r.end));
}

describe('Hebrew whole words', () => {
  it('ends a word at punctuation', () => {
    expect(words(hebrew(), 'דברי רבי אליעזר. וחכמים', 'אליעזר')).toEqual(['אליעזר']);
  });

  it('takes no prefix unless given some', () => {
    expect(words(hebrew(), 'אמר דרבי יוחנן', 'רבי')).toEqual([]);
  });

  it('takes stacked prefixes, marking them with the word', () => {
    expect(words(hebrew({ prefixes: PREFIXES }), 'אמר דרבי יוחנן וכשרבי', 'רבי')).toEqual([
      'דרבי',
      'וכשרבי',
    ]);
  });

  it('needs a word edge before the prefix', () => {
    expect(words(hebrew({ prefixes: PREFIXES }), 'זרבי', 'רבי')).toEqual([]);
  });

  it('lets only a phrase’s first word take a prefix', () => {
    const language = hebrew({ prefixes: PREFIXES });
    expect(words(language, 'מקל וחומר', 'קל וחומר')).toEqual(['מקל וחומר']);
    expect(words(language, 'קל ווחומר', 'קל וחומר')).toEqual([]);
  });

  it('claims a term holding a Hebrew letter', () => {
    expect(hebrew().claims('abc')).toBe(false);
    expect(hebrew().claims('רבי')).toBe(true);
  });
});

describe('hebrewOrEnglish', () => {
  it('names text with Hebrew letters as Hebrew, as a text names its languages, and other text as English', () => {
    expect(hebrewOrEnglish('שמות כב')).toBe('he');
    expect(hebrewOrEnglish('Exodus 22')).toBe('en');
  });
});
