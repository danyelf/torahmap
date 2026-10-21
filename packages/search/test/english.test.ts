import { describe, expect, it } from 'vitest';
import { english } from '../src/english.ts';

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
