// Search's files, and the text index and dictionary it builds from them.
import { optional } from '../dataFiles.ts';
import { TEXTS_FILE, type VerseTexts } from '../verseTexts.ts';
import type { Parse } from './dictionary.ts';
import {
  buildDictionary,
  buildTextIndex,
  type Dictionary,
  type DictionaryFiles,
  type TextIndex,
} from '../search.ts';

export type { DictionaryFiles };

/** What search reads: the verse texts, the three lexeme files, and the per-word parse. */
export interface SearchData extends DictionaryFiles {
  texts: VerseTexts;
  parse: Parse | null;
}

export const DICTIONARY_FILES = {
  lexicon: 'search/lexicon.json',
  forms: 'search/word-lexemes.json',
  verseLexemes: 'search/verse-lexemes.json',
} as const;

export const SEARCH_FILES = {
  texts: TEXTS_FILE,
  ...DICTIONARY_FILES,
  parse: optional('search/verse-morphology.json'),
} as const;

export function textIndexOf(data: SearchData): TextIndex {
  return buildTextIndex(data.texts);
}

export function dictionaryOf(data: SearchData): Dictionary {
  return buildDictionary(data);
}
