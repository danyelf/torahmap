// Every paragraph's English.
import { memoByValue } from '@torahmap/utils';
import { TERM_SEARCH_PARAMS } from '@torahmap/link';
import { buildTextIndex, createTermSearch, english, type SearchEntry } from '@torahmap/search';
import { TEXTS_FILE, type ActTexts } from './data.ts';
import { actRef } from './ids.ts';
import type { ActItem } from './layout.ts';

export interface ActSearchData {
  texts: ActTexts;
}

const LANGUAGES = [english];

function* entries(texts: ActTexts): Iterable<SearchEntry> {
  for (const [id, text] of Object.entries(texts)) {
    yield { id, ref: actRef(id), text: { [english.id]: text } };
  }
}

const indexes = memoByValue((texts: ActTexts) => buildTextIndex(entries(texts), LANGUAGES));

const search = createTermSearch<ActItem, ActSearchData>({
  languages: LANGUAGES,
  data: { texts: TEXTS_FILE },
  index: ({ texts }) => indexes(texts),
  noun: { one: 'paragraph', many: 'paragraphs' },
  placeholder: 'Search the Act…',
  description: 'Finds a word or phrase in any recital, article or annex.',
  urlParams: TERM_SEARCH_PARAMS,
});

export const actSearch = search.tool;
export const configureSearch = search.configure;
