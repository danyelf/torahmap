import { describe, it, expect } from 'vitest';
import { buildDictionary, buildTextIndex, type LexiconFile } from '../../search';
import { searchTool } from '../../overlays/search/index';
import { settingsFromLink } from '../../overlays/settings';
import { SEARCH_COLORS } from '../../utils/color';
import { createVerse } from '../helpers/fixtures';
import { searchDataFor } from '../helpers/searchData';
import type { VerseTexts } from '../../verseTexts';

const texts: VerseTexts = {
  Genesis: {
    1: {
      1: { he: 'קול גדול', en: 'a great voice' },
      2: { he: 'דבר אחר', en: 'another thing' },
    },
  },
};

/** A dictionary of one word, קול, filed under Genesis 1:2 alone. */
const lexicon: LexiconFile = {
  source: 'test',
  lexemes: [['QWL/', 'קוֹל', 'voice', 'subs', 'heb', 'קול']],
};
const forms = { 'קול': [0] };
const verseLexemes = { 'Genesis:1:2': [0] };

describe('what search builds from its files', () => {
  it('builds one text index per texts value', () => {
    expect(buildTextIndex(texts)).toBe(buildTextIndex(texts));
    expect(buildTextIndex({ ...texts })).not.toBe(buildTextIndex(texts));
  });

  it('builds one dictionary per set of files, whatever holds them', () => {
    const files = { lexicon, forms, verseLexemes };
    expect(buildDictionary({ ...files })).toBe(buildDictionary(files));
    expect(buildDictionary({ ...files, forms: { ...forms } })).not.toBe(buildDictionary(files));
  });
});

describe('one search over two dictionaries', () => {
  it('gives each dictionary its own answer', () => {
    const settings = settingsFromLink(searchTool, { search: 'קול' });
    const verses = [
      createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
      createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
    ];
    const unknown = searchDataFor(texts);
    const known = searchDataFor(texts, { lexicon, forms, verseLexemes });

    // Unknown to the dictionary the word finds nothing; known, it finds the
    // verses the dictionary files it under.
    expect(searchTool.colorsFor(verses, settings, null, unknown)).toEqual([null, null]);
    expect(searchTool.colorsFor(verses, settings, null, known)).toEqual([null, SEARCH_COLORS[0]]);
    expect(searchTool.colorsFor(verses, settings, null, unknown)).toEqual([null, null]);
  });
});
