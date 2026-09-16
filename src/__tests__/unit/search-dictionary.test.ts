// The dictionary seam: the only place that knows a meaning is an ETCBC lexeme.
//
// Search asks two questions here — what could this written form be, and which
// verses carry these meanings. Everything behind the seam is replaceable; the
// point of the seam is that `LexemeId`, which is an array position into the
// loaded dictionary and shifts whenever the index is regenerated, never
// escapes it.

import { describe, it, expect, beforeAll } from 'vitest';
import { loadLexiconData } from '../../search.ts';
import { meaningsFor, versesFor, formMatches } from '../../search/dictionary.ts';

beforeAll(async () => {
  await loadLexiconData();
});

describe('meaningsFor', () => {
  // This is the one place the exact list and the exact counts for עלה live.
  // Three other test files used to restate them, and every change to the index
  // meant editing four files to say the same thing once. They now assert the
  // property each of them is actually about.
  it('offers the five dictionary words that עלה can be, commonest first', () => {
    // "upon" is the Aramaic preposition על carrying a pronominal suffix, "upon
    // him", which is written exactly this way. The generator used to withhold
    // it, to keep 86 Aramaic verses out of a search for the verb; the
    // withholding cost עליו, בו and every other suffixed preposition.
    const meanings = meaningsFor('עלה');
    expect(meanings.map((m) => m.gloss)).toEqual([
      'ascend',
      'burnt-offering',
      'leafage',
      'upon',
      'pretext',
    ]);
  });

  it('keys a meaning by ETCBC id and language, because the id alone collides', () => {
    // <LH/ is burnt-offering in Hebrew and pretext in Aramaic. 461 lexemes
    // share an id with another this way, always a Hebrew/Aramaic pair.
    const meanings = meaningsFor('עלה');
    const burntOffering = meanings.find((m) => m.gloss === 'burnt-offering');
    const pretext = meanings.find((m) => m.gloss === 'pretext');

    expect(burntOffering?.keys).toEqual(['<LH/@heb']);
    expect(pretext?.keys).toEqual(['<LH/@arc']);
  });

  it('counts the verses each meaning occurs in', () => {
    const meanings = meaningsFor('עלה');
    // The order is by how often this spelling is read as each word, which is
    // not the same as how many verses each word occurs in — "upon" leads
    // "pretext" on both here, but a rarer reading of a commoner word can still
    // sort below a commoner reading of a rarer one.
    expect(meanings.map((m) => m.verseCount)).toEqual([818, 260, 13, 86, 2]);
  });

  it('absorbs prefixes, so the first word of Genesis is unambiguous', () => {
    const meanings = meaningsFor('בראשית');
    expect(meanings).toHaveLength(1);
    expect(meanings[0].gloss).toBe('beginning');
  });

  it('returns nothing for a form no dictionary word matches', () => {
    expect(meaningsFor('זזזזז')).toEqual([]);
  });

  it('merges candidates a reader could not tell apart into one row', () => {
    // ETCBC gives Shechem the man and Shechem the place separate entries, both
    // written שְׁכֶם. Two identical checkboxes are worse than one.
    const shechem = meaningsFor('שכם').filter((m) => m.gloss === 'Shechem');
    const merged = shechem.find((m) => m.keys.length > 1);

    expect(merged?.keys).toEqual(['CKM=/@heb', 'CKM==/@heb']);
  });

  it("counts a merged row's verses once, not once per entry", () => {
    // The two Shechem entries share two verses: 56 by addition, 54 in truth.
    const merged = meaningsFor('שכם').find((m) => m.keys.length > 1);

    expect(merged?.verseCount).toBe(54);
  });

  it('keeps a merged row where its likeliest member sat', () => {
    // Vocalization decides what merges: the two שְׁכֶם entries are one row, the
    // שֶׁכֶם entry stays its own. Asserted by key rather than by the pointed form,
    // because the same Hebrew word composes its marks in either order and the
    // two spellings compare unequal while looking identical.
    expect(meaningsFor('שכם').map((m) => [m.gloss, m.keys])).toEqual([
      ['Shechem', ['CKM=/@heb', 'CKM==/@heb']],
      ['shoulder', ['CKM/@heb']],
      ['Shechem', ['CKM===/@heb']],
    ]);
  });
});

describe('versesFor', () => {
  it('narrows to one meaning rather than the union of all of them', () => {
    const all = versesFor(meaningsFor('עלה').flatMap((m) => m.keys));
    const burntOffering = versesFor(['<LH/@heb']);

    // 1,112 rather than 1,028: the Aramaic preposition brings 86 verses of its
    // own, two of which already carried one of the other four readings.
    expect(all.size).toBe(1112);
    expect(burntOffering.size).toBe(260);
  });

  it('puts the fig leaves of Genesis 3:7 under leafage, not burnt-offering', () => {
    expect(versesFor(['<LH=/@heb']).has('Genesis:3:7')).toBe(true);
    expect(versesFor(['<LH/@heb']).has('Genesis:3:7')).toBe(false);
  });

  it('ignores a key that no longer resolves', () => {
    expect(versesFor(['NOT_A_LEXEME@heb']).size).toBe(0);
  });
});

describe('formMatches', () => {
  it('says a written word is one of the chosen meanings', () => {
    // ויעל is the verb ascend in a different spelling.
    expect(formMatches(['<LH[@heb'], 'ויעל')).toBe(true);
  });

  it('says it is not, when the reader narrowed to a different meaning', () => {
    // The same word is not a burnt-offering, so highlighting must not claim it.
    expect(formMatches(['<LH/@heb'], 'ויעל')).toBe(false);
  });

  it('is false for a word the dictionary does not know', () => {
    expect(formMatches(['<LH[@heb'], 'זזזזז')).toBe(false);
  });
});
