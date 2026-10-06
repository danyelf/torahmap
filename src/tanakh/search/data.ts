// Search's files, and the text index and dictionary it builds from them.
import { optional } from '../../dataFiles.ts';
import { STRUCTURE_FILE, TEXTS_FILE, type VerseTexts } from '../../verseTexts.ts';
import type { Parse } from './dictionary.ts';
import {
  buildDictionary,
  buildTextIndex,
  type BookOrder,
  type Dictionary,
  type DictionaryFiles,
  type TextIndex,
} from './search.ts';

export type { DictionaryFiles };

/** What search reads: the book order, the verse texts, the three lexeme files, and the per-word parse. */
export interface SearchData extends DictionaryFiles {
  structure: BookOrder;
  texts: VerseTexts;
  parse: Parse | null;
}

export const DICTIONARY_FILES = {
  lexicon: 'search/lexicon.json',
  forms: 'search/word-lexemes.json',
  verseLexemes: 'search/verse-lexemes.json',
} as const;

export const SEARCH_FILES = {
  structure: STRUCTURE_FILE,
  texts: TEXTS_FILE,
  ...DICTIONARY_FILES,
  parse: optional('search/verse-morphology.json'),
} as const;

export function textIndexOf(data: SearchData): TextIndex {
  return buildTextIndex(data.texts, data.structure);
}

export function dictionaryOf(data: SearchData): Dictionary {
  return buildDictionary(data);
}
