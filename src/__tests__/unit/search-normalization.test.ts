// How text is folded before it is looked up.
//
// normalizeHebrewForSearch() and normalize() in
// scripts/search/generate-lexeme-index.py must fold Hebrew identically, or the
// index keys and the lookups spell words differently and every lookup silently
// misses. Both sides read folding-cases.json; the Python half is in
// scripts/search/test_generate_lexeme_index.py.

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { findLexemesForWord } from '../../tanakh/search/search';
import { normalizeHebrewForSearch } from '../../hebrew';
import { realSearchData } from '../helpers/searchData';

const cases: Array<{ in: string; out: string; rule: string }> = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'scripts', 'search', 'folding-cases.json'), 'utf-8'),
);

describe('folding', () => {
  it.each(cases)('$rule', ({ in: input, out }) => {
    expect(normalizeHebrewForSearch(input)).toBe(out);
  });
});

describe('looking a word up', () => {
  const { dictionary } = realSearchData();

  it('finds Jerusalem, which Sefaria writes with a grapheme joiner inside it', () => {
    expect(findLexemesForWord(dictionary, 'ירושל͏ם')).toEqual(
      findLexemesForWord(dictionary, 'ירושלם'),
    );
    expect(findLexemesForWord(dictionary, 'ירושל͏ם')).not.toBeNull();
  });

  it('finds a word pasted with the punctuation that follows it', () => {
    // A separator folds to a space, so without trimming the lookup the pasted
    // form misses: no key carries an outer space.
    expect(findLexemesForWord(dictionary, 'הָאָרֶץ׃')).toEqual(
      findLexemesForWord(dictionary, 'הארץ'),
    );
    expect(findLexemesForWord(dictionary, 'הָאָרֶץ׃')).not.toBeNull();
    expect(findLexemesForWord(dictionary, 'עַל־')).toEqual(findLexemesForWord(dictionary, 'על'));
  });
});
