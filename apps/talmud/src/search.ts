// The Talmud's search: @torahmap/search's term search over every segment, in
// the Davidson edition, which spells abbreviations out. A whole word may carry
// the letters Hebrew and Aramaic attach in front of one. English searches the
// Davidson translation's bold, its literal translation.
import { memoByValue, memoByValueAndKey } from '@torahmap/utils';
import { hebrew } from '@torahmap/hebrew';
import { TERM_SEARCH_PARAMS } from '@torahmap/link';
import { optional } from '@torahmap/shell/dataFiles.ts';
import {
  activeTerms,
  buildTextIndex,
  createTermSearch,
  english,
  languageOf,
  type SearchEntry,
} from '@torahmap/search';
import { talmudId, talmudRef, type TalmudLayoutItem } from './layout.ts';
import {
  SEARCH_ENGLISH_FILE,
  SEARCH_FILE,
  STRUCTURE_FILE,
  type TalmudSearchText,
  type TalmudStructure,
} from './data.ts';

/** What search reads: the tractates' order and pages, and their search text in each language. */
export interface TalmudSearchData {
  structure: TalmudStructure;
  text: TalmudSearchText;
  /** Downloads after the rest, or at once for an English term. */
  english: TalmudSearchText | null;
}

const LANGUAGES = [hebrew({ prefixes: 'דולבכשמה' }), english];

function* entries(
  structure: TalmudStructure,
  text: TalmudSearchText,
  translation: TalmudSearchText | null,
): Iterable<SearchEntry> {
  for (const { name: tractate, amudim } of structure.tractates) {
    const pages = text[tractate] ?? [];
    const translated = translation?.[tractate] ?? [];
    for (const [ai, { daf, amud }] of amudim.entries()) {
      for (const [si, he] of (pages[ai] ?? []).entries()) {
        const segment = { tractate, daf, amud, segment: si + 1 };
        const en = translated[ai]?.[si];
        yield {
          id: talmudId(segment),
          ref: talmudRef(segment),
          text: en === undefined ? { he } : { he, en },
        };
      }
    }
  }
}

// Per structure, then per search text and English.
const indexes = memoByValue((structure: TalmudStructure) =>
  memoByValueAndKey((text: TalmudSearchText, translation: TalmudSearchText | null) =>
    buildTextIndex(entries(structure, text, translation), LANGUAGES),
  ),
);

const search = createTermSearch<TalmudLayoutItem, TalmudSearchData>({
  languages: LANGUAGES,
  data: { structure: STRUCTURE_FILE, text: SEARCH_FILE, english: optional(SEARCH_ENGLISH_FILE) },
  index: ({ structure, text, english: translation }) => indexes(structure)(text, translation),
  filesFor: (settings) =>
    activeTerms(settings).some((term) => languageOf(LANGUAGES, term) === english)
      ? [SEARCH_ENGLISH_FILE]
      : [],
  noun: { one: 'segment', many: 'segments' },
  // A prefix is part of a whole word here, and a short word as a substring
  // lights most of the map: רב is inside רבי, רבה, רבא and ערב.
  defaultMode: 'word',
  placeholder: 'Search Hebrew, Aramaic or English…',
  description: 'Any word or phrase of the Talmud, or of its translation.',
  urlParams: TERM_SEARCH_PARAMS,
});

export const talmudSearch = search.tool;
export const configureSearch = search.configure;
