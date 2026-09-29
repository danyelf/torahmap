// Two things a row per term has to get right.
//
// Nothing stops a reader putting Hebrew in one row and English in the next —
// and nothing should, so language is decided per term. A row can also be blank,
// and a blank row means "nothing yet", not "everything".

import { describe, it, expect, beforeAll } from 'vitest';
import { loadLexiconData, buildSearchIndex, versesForTerm } from '../../search.ts';
import { addTerm, termQuery } from '../../search/terms.ts';
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
  // A term's own text decides which text it is looked for in, so an English
  // word beside a Hebrew one is not hunted for in the Hebrew.
  const found = (text: string): Set<string> => {
    const { language } = termQuery(addTerm([], text)[0]);
    return versesForTerm(text, language, 'substring');
  };

  it('finds an English term in the English text', () => {
    expect(found('heaven').size).toBeGreaterThan(0);
  });

  it('finds a Hebrew term in the Hebrew text', () => {
    expect(found('אלהים').size).toBeGreaterThan(0);
  });
});
