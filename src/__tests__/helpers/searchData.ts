// Search's files for tests: the shipped ones, read from disk, or made-up texts
// with a dictionary that knows no word.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDictionary, type Dictionary, type TextIndex } from '../../search';
import {
  DICTIONARY_FILES,
  dictionaryOf,
  SEARCH_FILES,
  textIndexOf,
  type DictionaryFiles,
  type SearchData,
} from '../../search/data';
import type { Parse } from '../../search/dictionary';
import type { VerseTexts } from '../../verseTexts';
import { EMPTY_DICTIONARY_FILES } from './fixtures';

export { EMPTY_DICTIONARY_FILES };

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public', 'data');
const read = <T>(path: string): T => JSON.parse(readFileSync(join(dataDir, path), 'utf8'));

export const EMPTY_DICTIONARY: Dictionary = buildDictionary(EMPTY_DICTIONARY_FILES);

/** Search's files: these texts, with the files given or a dictionary that knows no word. */
export function searchDataFor(texts: VerseTexts, files: Partial<SearchData> = {}): SearchData {
  return { texts, ...EMPTY_DICTIONARY_FILES, parse: null, ...files };
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
