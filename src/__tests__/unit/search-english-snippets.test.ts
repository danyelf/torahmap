// An English term's result should quote the English verse.
//
// Results built by `resultsForVerseSets` carry no snippet, so the list asks
// `computeSnippetForMatch` for one when it draws the row. That function was
// written for Hebrew, and every English row went through it.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildSearchIndex,
  computeSnippetForMatch,
  resultsForVerseSets,
  type SearchResult,
} from '../../search';
import type { VerseTexts } from '../../verseTexts';

const HEBREW = /[֐-׿]/;

const texts: VerseTexts = {
  Genesis: {
    '9': {
      '9': {
        he: 'וַאֲנִי הִנְנִי מֵקִים אֶת־בְּרִיתִי אִתְּכֶם',
        en: 'And I, behold, I establish my covenant with you',
      },
    },
    '17': {
      '7': {
        he: 'וַהֲקִמֹתִי אֶת־בְּרִיתִי בֵּינִי וּבֵינֶךָ',
        en: 'And I will establish my covenant between me and thee',
      },
    },
  },
};

beforeEach(() => {
  buildSearchIndex(texts);
});

/** A result shaped the way the meaning filter builds them: no snippet yet. */
function lazyResult(language: 'he' | 'en'): SearchResult {
  return resultsForVerseSets([new Set(['Genesis:9:9'])], [language])[0];
}

describe('snippets for an English term', () => {
  it('quotes the English verse, not the Hebrew one', () => {
    const snippet = computeSnippetForMatch(lazyResult('en'), 0, 'covenant');

    expect(snippet).not.toBeNull();
    expect(snippet!.snippet).toContain('covenant');
    expect(snippet!.snippet).not.toMatch(HEBREW);
  });

  it('marks the word that was searched for', () => {
    const snippet = computeSnippetForMatch(lazyResult('en'), 0, 'covenant')!;
    const marked = snippet.snippet.slice(snippet.matchStart, snippet.matchEnd);

    expect(marked).toBe('covenant');
  });

  it('matches without regard to case', () => {
    const snippet = computeSnippetForMatch(lazyResult('en'), 0, 'Covenant')!;
    const marked = snippet.snippet.slice(snippet.matchStart, snippet.matchEnd);

    // The verse prints it lowercase; the reader typed it capitalised.
    expect(marked).toBe('covenant');
  });

  it('still quotes Hebrew for a Hebrew term', () => {
    const snippet = computeSnippetForMatch(lazyResult('he'), 0, 'בריתי')!;

    expect(snippet.snippet).toMatch(HEBREW);
  });

  it('falls back to the English verse when the word is not in it', () => {
    const snippet = computeSnippetForMatch(lazyResult('en'), 0, 'chariot')!;

    // Nothing to mark, but the reader should still be reading the right verse.
    expect(snippet.snippet).not.toMatch(HEBREW);
    expect(snippet.matchStart).toBe(0);
    expect(snippet.matchEnd).toBe(0);
  });
});

describe('a Hebrew term beside an English one', () => {
  // Genesis 17:7 is reached by both; Genesis 9:9 only by the English term,
  // which is the row that used to quote a Hebrew verse nobody had searched.
  const hebrewTerm = 'בריתי';
  const englishTerm = 'behold';

  function mixedResults() {
    return resultsForVerseSets(
      [new Set(['Genesis:17:7']), new Set(['Genesis:17:7', 'Genesis:9:9'])],
      ['he', 'en'],
    );
  }

  it('quotes English for a verse only the English term found', () => {
    const only = mixedResults().find((r) => r.verse === 9)!;

    expect(only.matchingTerms.map((m) => m.termIndex)).toEqual([1]);

    const snippet = computeSnippetForMatch(only, 1, englishTerm)!;
    expect(snippet.snippet).not.toMatch(HEBREW);
    expect(snippet.snippet.slice(snippet.matchStart, snippet.matchEnd)).toBe('behold');
  });

  it('quotes Hebrew for a verse the Hebrew term claimed first', () => {
    const both = mixedResults().find((r) => r.verse === 7)!;

    expect(both.matchingTerms[0].termIndex).toBe(0);
    expect(computeSnippetForMatch(both, 0, hebrewTerm)!.snippet).toMatch(HEBREW);
  });
});
