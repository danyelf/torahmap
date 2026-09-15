// Which dictionary word is this word, here?
//
// A Hebrew word written without vowels is usually several different words, and
// the spelling alone cannot say which. The verse can: the reading of a word in
// front of you is one the verse contains, and the other candidates usually are
// not.

import { describe, it, expect, beforeAll } from 'vitest';
import { loadLexiconData } from '../../../search';
import { meaningsInVerse, meaningsFor } from '../../../search/dictionary';

beforeAll(async () => {
  await loadLexiconData();
});

describe('resolving a word against its verse', () => {
  it('reads עלה in Genesis 3:7 as a leaf, not as the commoner "ascend"', () => {
    // The whole feature in one case. By frequency the spelling עלה is most
    // often the verb "ascend" (818 verses) and the fig leaf is its rarest
    // reading (13). The verse settles it the other way.
    const meanings = meaningsInVerse('עלה', 'Genesis:3:7');

    expect(meanings).toHaveLength(1);
    expect(meanings[0].gloss).toBe('leafage');
  });

  it('reads ורוח in Genesis 1:2 as wind, prefix and all', () => {
    // The ו is part of the written word; the index files whole tokens under
    // the lexeme of their stem, so the prefix must not have to be stripped.
    const meanings = meaningsInVerse('ורוח', 'Genesis:1:2');

    expect(meanings).toHaveLength(1);
    expect(meanings[0].gloss).toBe('wind');
  });

  it('offers both readings of עלת in Genesis 8:20, where the verse carries both', () => {
    // Noah offers burnt-offerings (עלת) and the verb "ascend" appears in the
    // same verse as ויעל. The verse cannot choose between them and neither
    // should we.
    const glosses = meaningsInVerse('עלת', 'Genesis:8:20').map((m) => m.gloss);

    expect(glosses).toContain('burnt-offering');
    expect(glosses).toContain('ascend');
  });

  it('offers nothing for an inflected function word', () => {
    // לו "to him" is absent from the index: the generator files a function word
    // only under its own bare spelling. What is left is the unrelated לוּ "if
    // only", which this verse does not contain.
    expect(meaningsInVerse('לו', 'Genesis:2:18')).toEqual([]);
  });

  it('never offers a reading the spelling alone does not allow', () => {
    // The verse narrows; it must never widen.
    const narrowed = meaningsInVerse('עלה', 'Genesis:3:7');
    const fromSpelling = new Set(meaningsFor('עלה').map((m) => m.keys[0]));

    for (const meaning of narrowed) {
      expect(fromSpelling.has(meaning.keys[0])).toBe(true);
    }
  });

  it('returns nothing for a verse it has no data for', () => {
    expect(meaningsInVerse('עלה', 'Nowhere:1:1')).toEqual([]);
  });
});
