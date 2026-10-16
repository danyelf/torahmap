// The Talmud's search: @torahmap/search's term search over every segment, in
// the Davidson edition, which spells abbreviations out. A whole word may carry
// the letters Hebrew and Aramaic attach in front of one.
import { memoByValue } from '@torahmap/utils';
import { hebrew } from '@torahmap/hebrew';
import { TERM_SEARCH_PARAMS } from '@torahmap/link';
import {
  buildTextIndex,
  createTermSearch,
  type SearchEntry,
  type TermSettings,
} from '@torahmap/search';
import { talmudId, talmudRef, type TalmudLayoutItem } from './layout.ts';
import {
  SEARCH_FILE,
  STRUCTURE_FILE,
  type TalmudSearchText,
  type TalmudStructure,
} from './data.ts';

export type TalmudSearchSettings = TermSettings;

/** What search reads: the tractates' order and pages, and their search text. */
export interface TalmudSearchData {
  structure: TalmudStructure;
  text: TalmudSearchText;
}

export const TALMUD_SEARCH_PARAMS = TERM_SEARCH_PARAMS;

const LANGUAGES = [hebrew({ prefixes: 'דולבכשמה' })];

function* entries(structure: TalmudStructure, text: TalmudSearchText): Iterable<SearchEntry> {
  for (const { name: tractate, amudim } of structure.tractates) {
    const pages = text[tractate] ?? [];
    for (const [ai, { daf, amud }] of amudim.entries()) {
      for (const [si, he] of (pages[ai] ?? []).entries()) {
        const segment = { tractate, daf, amud, segment: si + 1 };
        yield { id: talmudId(segment), ref: talmudRef(segment), text: { he } };
      }
    }
  }
}

// Per structure, then per search text.
const indexes = memoByValue((structure: TalmudStructure) =>
  memoByValue((text: TalmudSearchText) => buildTextIndex(entries(structure, text), LANGUAGES)),
);

const search = createTermSearch<TalmudLayoutItem, TalmudSearchData>({
  languages: LANGUAGES,
  data: { structure: STRUCTURE_FILE, text: SEARCH_FILE },
  index: ({ structure, text }) => indexes(structure)(text),
  noun: { one: 'segment', many: 'segments' },
  placeholder: 'Search Hebrew or Aramaic…',
  description: 'Any word or phrase of the Talmud.',
  urlParams: TALMUD_SEARCH_PARAMS,
});

export const talmudSearch = search.tool;
export const configureSearch = search.configure;
