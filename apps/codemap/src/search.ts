// Every line's text.
import { memoByValueAndKey } from '@torahmap/utils';
import { TERM_SEARCH_PARAMS } from '@torahmap/link';
import { buildTextIndex, createTermSearch, english, type SearchEntry } from '@torahmap/search';
import { STRUCTURE_FILE, TEXTS_FILE, type CodeStructure, type CodeTexts } from './data.ts';
import { lineId } from './ids.ts';
import type { CodeItem } from './layout.ts';

export interface CodeSearchData {
  structure: CodeStructure;
  texts: CodeTexts;
}

const LANGUAGES = [english];

function* entries(structure: CodeStructure, texts: CodeTexts): Iterable<SearchEntry> {
  for (const [f, lines] of texts.entries()) {
    const path = structure.files[f].path;
    for (const [i, text] of lines.entries()) {
      const id = lineId(path, i + 1);
      yield { id, ref: id, text: { [english.id]: text } };
    }
  }
}

const indexes = memoByValueAndKey((texts: CodeTexts, structure: CodeStructure) =>
  buildTextIndex(entries(structure, texts), LANGUAGES),
);

const search = createTermSearch<CodeItem, CodeSearchData>({
  languages: LANGUAGES,
  data: { structure: STRUCTURE_FILE, texts: TEXTS_FILE },
  index: ({ texts, structure }) => indexes(texts, structure),
  noun: { one: 'line', many: 'lines' },
  placeholder: 'Search the code…',
  description: 'Finds a word or phrase in any line of the code.',
  urlParams: TERM_SEARCH_PARAMS,
});

export const codeSearch = search.tool;
export const configureSearch = search.configure;
