import { english, itemsForTerm, type MatchMode, type TextIndex } from '@torahmap/search';
import { HEBREW, type TextLanguage } from '@torahmap/shell/language.ts';
import { TANAKH_LANGUAGES } from '../../src/search/languages.ts';
// Search's files for tests: the shipped ones, read from disk, or made-up texts
// with a dictionary that knows no word.
import { memoByValue } from '@torahmap/utils';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDictionary, type BookOrder, type Dictionary } from '../../src/search/search';
import {
  DICTIONARY_FILES,
  dictionaryOf,
  SEARCH_FILES,
  textIndexOf,
  type DictionaryFiles,
  type SearchData,
} from '../../src/search/data';
import type { Parse } from '../../src/search/dictionary';
import type { VerseTexts } from '../../src/verseTexts';
import { EMPTY_DICTIONARY_FILES } from './fixtures';

export { EMPTY_DICTIONARY_FILES };

const dataDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'public',
  'data',
);
const read = <T>(path: string): T => JSON.parse(readFileSync(join(dataDir, path), 'utf8'));

export const EMPTY_DICTIONARY: Dictionary = buildDictionary(EMPTY_DICTIONARY_FILES);

/** The books in the order the texts hold them, as a structure file would list them. */
export const inTextsOrder = memoByValue((texts: VerseTexts): BookOrder => ({
  books: Object.keys(texts).map((name) => ({ name })),
}));

/** Search's files: these texts in their own order, with the files given or a dictionary that knows no word. */
export function searchDataFor(texts: VerseTexts, files: Partial<SearchData> = {}): SearchData {
  return {
    structure: inTextsOrder(texts),
    texts,
    ...EMPTY_DICTIONARY_FILES,
    parse: null,
    ...files,
  };
}

interface RealSearchData {
  files: SearchData;
  index: TextIndex;
  dictionary: Dictionary;
  parse: Parse;
}

let real: RealSearchData | null = null;

/** The shipped files, read once per test file, and what search builds from them. */
export function realSearchData(): RealSearchData {
  if (!real) {
    const files: SearchData = {
      structure: read(SEARCH_FILES.structure),
      texts: read(SEARCH_FILES.texts),
      ...(Object.fromEntries(
        Object.entries(DICTIONARY_FILES).map(([name, path]) => [name, read(path)]),
      ) as DictionaryFiles),
      parse: read(SEARCH_FILES.parse.optional),
    };
    real = {
      files,
      index: textIndexOf(files),
      dictionary: dictionaryOf(files),
      parse: files.parse!,
    };
  }
  return real;
}

/** The verses a term's text matches in `language`'s text, as the search finds them. */
export function versesForTerm(
  index: TextIndex,
  text: string,
  language: TextLanguage,
  mode: MatchMode,
): Set<string> {
  return itemsForTerm(index, text, language === HEBREW ? TANAKH_LANGUAGES[0] : english, mode);
}
