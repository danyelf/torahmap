import { describe, expect, it } from 'vitest';
import { english } from '../src/english.ts';
import { matchRanges } from '../src/index.ts';

function words(text: string, term: string) {
  return english.wholeWords(english.fold(text), english.fold(term), Infinity);
}

describe('english whole words', () => {
  it('reads a letter with a mark as part of its word', () => {
    expect(words('Rabbi Yoḥanan said', 'yo')).toEqual([]);
    expect(words('Rabbi Yoḥanan said', 'hanan')).toEqual([]);
    expect(words('Rabbi Yoḥanan said', 'Yoḥanan')).toEqual([{ start: 6, end: 13 }]);
  });

  it('ends a word at an apostrophe, straight or curly', () => {
    expect(words("Israel's tents", 'israel')).toEqual([{ start: 0, end: 6 }]);
    expect(words('Israel’s tents', 'israel')).toEqual([{ start: 0, end: 6 }]);
  });
});

describe('english accents', () => {
  const text = 'Rabbi Joḥanon met Ḥanina at a café, naïve.';
  const found = (term: string, mode: 'substring' | 'word') =>
    matchRanges(english.fold(text), english.fold(term), { mode, language: english }).map(
      ({ start, end }) => text.slice(start, end),
    );

  it('finds an accented word from plain letters, whole or in part', () => {
    expect(found('johanon', 'word')).toEqual(['Joḥanon']);
    expect(found('hanina', 'word')).toEqual(['Ḥanina']);
    expect(found('cafe', 'word')).toEqual(['café']);
    expect(found('hanon', 'substring')).toEqual(['ḥanon']);
  });

  it('finds the same word when the term carries the accent', () => {
    expect(found('joḥanon', 'word')).toEqual(['Joḥanon']);
    expect(found('naïve', 'word')).toEqual(['naïve']);
  });

  it('marks a word as written, accents included', () => {
    expect(found('johanon', 'substring')).toEqual(['Joḥanon']);
  });
});
