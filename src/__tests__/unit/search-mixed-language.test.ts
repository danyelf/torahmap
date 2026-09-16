// Two bugs a second search row made visible.
//
// Terms used to be substrings of one box, and one box was one language. With a
// row each, nothing stops a reader putting Hebrew in one and English in the
// next — and nothing should. A blank row is also now a thing that exists, and
// it must mean "nothing yet", not "everything".

import { describe, it, expect, beforeAll } from 'vitest';
import { loadLexiconData, buildSearchIndex, verseSetsForTerms } from '../../search.ts';
import { ALL_TEXTS_FIXTURE } from '../helpers/mixedLanguageTexts.ts';
import { meaningsFor, versesFor } from '../../search/dictionary.ts';

beforeAll(async () => {
  await loadLexiconData();
  buildSearchIndex(ALL_TEXTS_FIXTURE);
});

describe('a term too short to be a word', () => {
  it('resolves a blank term to nothing at all', () => {
    // It used to resolve to every lexeme in the dictionary, because the
    // fallback prefix scan asks whether each spelling startsWith the term —
    // and every string starts with "".
    expect(meaningsFor('')).toEqual([]);
    expect(versesFor(meaningsFor('').flatMap((m) => m.keys)).size).toBe(0);
  });

  it('resolves a single letter to nothing', () => {
    // א used to offer 911 meanings covering 19,689 verses.
    expect(meaningsFor('א')).toEqual([]);
  });

  it('still resolves a short word that really is a word', () => {
    // Only the guessing is gated, not the dictionary. אל is a written form in
    // its own right with ten real readings, and two letters is enough for it.
    const glosses = meaningsFor('אל').map((m) => m.gloss);
    expect(glosses).toContain('god');
    expect(glosses).toContain('to');
  });

  it('still knows אב is father', () => {
    expect(meaningsFor('אב').some((m) => m.gloss.includes('father'))).toBe(true);
  });

  it('leaves an ordinary three-letter word alone', () => {
    // The property here is that three letters clears the guard, not what the
    // readings are — search-dictionary.test.ts owns the list.
    expect(meaningsFor('עלה').map((m) => m.gloss)).toContain('ascend');
  });
});

describe('one language per term, not one per search', () => {
  // The whole search used to take its language from the FIRST term, so a
  // Hebrew word beside an English one meant the English one was hunted for in
  // the Hebrew text and found nothing. #97 predicted this; a row each made it
  // easy to hit.

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
