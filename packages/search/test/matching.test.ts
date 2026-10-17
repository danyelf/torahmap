import { describe, expect, it } from 'vitest';
import { english, matchRanges, type SearchLanguage } from '../src/index.ts';

/** A language whose words are runs of the letter x. */
const xs: SearchLanguage = {
  id: 'xs',
  rtl: false,
  claims: (term) => term.includes('x'),
  fold: (text) => text,
  toOriginal: (_text, at) => at,
  wholeWords: (haystack, needle) => {
    const at = haystack.indexOf(` ${needle} `);
    return at === -1 ? [] : [{ start: at + 1, end: at + 1 + needle.length }];
  },
};

describe('matchRanges', () => {
  it('finds a substring anywhere, as often as it occurs', () => {
    expect(matchRanges('xx axx', 'xx', { mode: 'substring', language: xs })).toEqual([
      { start: 0, end: 2 },
      { start: 4, end: 6 },
    ]);
  });

  it('stops at the limit', () => {
    expect(matchRanges('xx xx', 'xx', { mode: 'substring', language: xs, limit: 1 })).toEqual([
      { start: 0, end: 2 },
    ]);
  });

  it('hands whole words to the language', () => {
    expect(matchRanges('a xx b', 'xx', { mode: 'word', language: xs })).toEqual([
      { start: 2, end: 4 },
    ]);
  });

  it('matches English whole words at word boundaries', () => {
    const text = english.fold('The Lord, the lords.');
    expect(matchRanges(text, english.fold('lord'), { mode: 'word', language: english })).toEqual([
      { start: 4, end: 8 },
    ]);
  });
});
