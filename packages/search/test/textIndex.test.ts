import { describe, expect, it } from 'vitest';
import {
  buildTextIndex,
  displayedText,
  english,
  itemsForTerm,
  quoteText,
  resultsForItemSets,
  type SearchLanguage,
} from '../src/index.ts';

/** A second language, read from each entry's `up` text, compared in capitals. */
const upper: SearchLanguage = {
  ...english,
  id: 'up',
  claims: (term) => term === term.toUpperCase(),
  fold: (text) => text.toUpperCase(),
};

const index = buildTextIndex(
  [
    { id: 'a', ref: 'First', text: { en: 'the river runs', up: 'A HILL' } },
    { id: 'b', ref: 'Second', text: { en: 'a hill stands', up: 'THE RIVER' } },
  ],
  [upper, english],
);

describe('the text index', () => {
  it('matches a term in its own language’s text only', () => {
    expect(itemsForTerm(index, 'river', english, 'word')).toEqual(new Set(['a']));
    expect(itemsForTerm(index, 'RIVER', upper, 'word')).toEqual(new Set(['b']));
  });

  it('gives back the text as written', () => {
    expect(displayedText(index, 'b', english)).toBe('a hill stands');
    expect(displayedText(index, 'missing', english)).toBeNull();
  });

  it('names each result by its entry’s reference, with the terms that found it', () => {
    const results = resultsForItemSets(index, [new Set(['a']), new Set(['a', 'b'])]);
    expect(results.map((r) => [r.id, r.ref, r.matchingTerms.map((m) => m.termIndex)])).toEqual([
      ['a', 'First', [0, 1]],
      ['b', 'Second', [1]],
    ]);
  });
});

describe('quoteText', () => {
  it('cuts beside an ellipsis in the text with one ellipsis, and keeps the match', () => {
    for (const ellipsis of [' … ', '… ', ' …', '...', ' ... ', '. … ']) {
      for (let gap = 0; gap < 70; gap++) {
        const text = `${'x '.repeat(30)}${ellipsis}${'w'.repeat(gap)} recite ${'w'.repeat(70 - gap)}${ellipsis}${'y '.repeat(40)}`;
        const start = text.indexOf('recite');
        const { snippet, matchStart, matchEnd } = quoteText(text, { start, end: start + 6 });
        expect(snippet).not.toMatch(/(\.\.\.|…)\s*(\.\.\.|…)/);
        expect(snippet.slice(matchStart, matchEnd)).toBe('recite');
      }
      const opening = `${'w'.repeat(58)}${ellipsis}${'y '.repeat(40)}`;
      expect(quoteText(opening, null).snippet).not.toMatch(/(\.\.\.|…)\s*(\.\.\.|…)/);
    }
  });
});
