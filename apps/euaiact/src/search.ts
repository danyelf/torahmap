// The Act's search: @torahmap/search's term search over every paragraph's English.
import { memoByValue } from '@torahmap/utils';
import { TERM_SEARCH_PARAMS } from '@torahmap/link';
import { ENGLISH } from '@torahmap/shell/language.ts';
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
    yield { id, ref: actRef(id), text: { [ENGLISH]: text } };
  }
}

const indexes = memoByValue((texts: ActTexts) => buildTextIndex(entries(texts), LANGUAGES));

const search = createTermSearch<ActItem, ActSearchData>({
  languages: LANGUAGES,
  data: { texts: TEXTS_FILE },
  index: ({ texts }) => indexes(texts),
  noun: { one: 'paragraph', many: 'paragraphs' },
  // A short word as a substring lights much of the Act: "act" is inside "fact", "impact" and "action".
  defaultMode: 'word',
  placeholder: 'Search the Act…',
  description: 'Finds a word or phrase in any recital, article or annex.',
  urlParams: TERM_SEARCH_PARAMS,
});

export const actSearch = search.tool;
export const configureSearch = search.configure;
