// Two things a row per term has to get right.
//
// Nothing stops a reader putting Hebrew in one row and English in the next —
// and nothing should, so language is decided per term. A row can also be blank,
// and a blank row means "nothing yet", not "everything".

import { describe, it, expect, beforeAll } from 'vitest';
import { loadLexiconData, buildSearchIndex, verseSetsForTerms } from '../../search.ts';
import { ALL_TEXTS_FIXTURE } from '../helpers/mixedLanguageTexts.ts';
import { meaningsFor, versesFor } from '../../search/dictionary.ts';

beforeAll(async () => {
  await loadLexiconData();
  buildSearchIndex(ALL_TEXTS_FIXTURE);
});

// Both lookups are exact, so nothing here turns on how long a term is. A
// fragment resolves to nothing because no word is spelled that way, and a short
// word resolves because one is.
describe('a fragment is not a word', () => {
  it('resolves a blank term to nothing at all', () => {
    // A prefix lookup resolves it to every lexeme there is, since every
    // dictionary spelling startsWith the empty string.
    expect(meaningsFor('')).toEqual([]);
    expect(versesFor(meaningsFor('').flatMap((m) => m.keys)).size).toBe(0);
  });

  it('resolves a single letter to nothing', () => {
    // Under a prefix lookup א offers 911 meanings covering 19,689 verses.
    expect(meaningsFor('א')).toEqual([]);
  });

  it('still resolves a short word that really is a word', () => {
    const glosses = meaningsFor('אל').map((m) => m.gloss);
    expect(glosses).toContain('god');
    expect(glosses).toContain('to');
  });

  it('still knows אב is father', () => {
    expect(meaningsFor('אב').some((m) => m.gloss.includes('father'))).toBe(true);
  });

  it('leaves an ordinary three-letter word alone', () => {
    // search-dictionary.test.ts owns the list of readings.
    expect(meaningsFor('עלה').map((m) => m.gloss)).toContain('ascend');
  });
});

describe('one language per term, not one per search', () => {
  // Language is decided per term. Taking it from the first term instead means
  // an English word beside a Hebrew one is hunted for in the Hebrew text,
  // where it finds nothing.

  it('finds the English term when a Hebrew term comes first', () => {
    const sets = verseSetsForTerms(['אלהים', 'heaven']);
    expect(sets[1].size).toBeGreaterThan(0);
  });

  it('finds the Hebrew term when an English term comes first', () => {
    const sets = verseSetsForTerms(['heaven', 'אלהים']);
    expect(sets[1].size).toBeGreaterThan(0);
  });

  it('gives each term the same hits whichever order they are written in', () => {
    const [hebFirst, enFirst] = [
      verseSetsForTerms(['אלהים', 'heaven']),
      verseSetsForTerms(['heaven', 'אלהים']),
    ];

    expect(hebFirst[0].size).toBe(enFirst[1].size);
    expect(hebFirst[1].size).toBe(enFirst[0].size);
  });

  it('is unaffected by the other term being there at all', () => {
    const alone = verseSetsForTerms(['heaven']);
    const paired = verseSetsForTerms(['אלהים', 'heaven']);

    expect(paired[1].size).toBe(alone[0].size);
  });
});
