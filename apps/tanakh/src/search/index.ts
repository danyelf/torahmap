// The Tanakh's search: @torahmap/search's term search over its verses, in
// Hebrew and English, with meanings mode beside substring and whole word.
import {
  canAddTerm,
  createTermSearch,
  isSearching,
  SEARCH_RECORD_DELAY_MS,
  type ExtraMode,
  type TermSettings,
} from '@torahmap/search';
import { HEBREW } from '@torahmap/shell/language.ts';
import { trackSearchExecute } from '@torahmap/shell/analytics.ts';
import { MEANINGS_KEY, SEARCH_URL_PARAMS } from '@torahmap/overlay-catalog';
import type { TanakhLayout } from '../types.ts';
import { dictionaryOf, SEARCH_FILES, textIndexOf, type SearchData } from './data.ts';
import { spellingFor, versesFor, wordsOfVerse } from './dictionary.ts';
import type { Dictionary } from './search.ts';
import {
  allMeanings,
  applyMeanings,
  chosenMeanings,
  encodeMeanings,
  isNarrowed,
  meaningRanges,
  meaningsData,
  meaningsMode,
  quotedMeaning,
  selectedKeys,
  type MeaningsData,
} from './meanings.ts';
import { meaningSummary, renderMeanings } from './meaningRows.ts';
import { TANAKH_LANGUAGES } from './languages.ts';
import { searchTelemetry } from './telemetry.ts';

export type SearchSettings = TermSettings;
export { canAddTerm, isSearching };

/** Whether two sets of search's files differ only in the per-word parse. */
function onlyParseDiffers(a: SearchData, b: SearchData): boolean {
  const keys = Object.keys(SEARCH_FILES) as (keyof SearchData)[];
  return keys.every((key) => key === 'parse' || a[key] === b[key]);
}

/** Meanings mode, as the search runs it. */
const meanings: ExtraMode<MeaningsData, SearchData> = {
  ...meaningsMode,
  build: (data) => meaningsData(dictionaryOf(data), data.parse),
  itemsFor: ({ dictionary }, term) => versesFor(dictionary, selectedKeys(dictionary, term)),
  ranges: ({ dictionary, parse }, term, { itemId, text, language }) =>
    language.id === HEBREW
      ? meaningRanges(dictionary, wordsOfVerse(parse, itemId, text), term, text, language)
      : [],
  quoted: quotedMeaning,
  // Each word as typed, then which of its checked meanings this verse holds.
  hoverNote({ dictionary }, term, itemId) {
    const here = chosenMeanings(dictionary, term)
      .filter((m) => versesFor(dictionary, m.keys).has(itemId))
      .map((m) => m.gloss);
    return `${term.text} (${here.join(', ')})`;
  },
  summary: ({ dictionary }, term) => meaningSummary(dictionary, term),
  restore: {
    label: 'all',
    title: 'Put every meaning back',
    shown: ({ dictionary }, term) => isNarrowed(dictionary, term),
    apply: allMeanings,
  },
  renderBody: (body, term, inThisMode, x, edit) =>
    renderMeanings(body, term, inThisMode, x?.dictionary ?? null, edit),
  param: { key: MEANINGS_KEY, write: encodeMeanings, read: applyMeanings },
};

export const tanakhSearch = createTermSearch<TanakhLayout, SearchData, MeaningsData>({
  languages: TANAKH_LANGUAGES,
  data: SEARCH_FILES,
  index: textIndexOf,
  noun: { one: 'verse', many: 'verses' },
  placeholder: 'Search Hebrew or English…',
  description: 'Any word, Hebrew or English.',
  credits: [
    {
      source:
        'Eep Talstra Centre for Bible and Computer, ' +
        'Biblia Hebraica Stuttgartensia Amstelodamensis (2021)',
      url: 'https://doi.org/10.17026/dans-z6y-skyh',
      license: 'CC BY-NC 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-nc/4.0/',
      collected: 'September 2026',
      note: 'Cite 10.17026/dans-z6y-skyh. Available on GitHub at github.com/ETCBC/bhsa.',
    },
  ],
  urlParams: SEARCH_URL_PARAMS,
  // The parse marks a word better than its spelling: the list is quoted again in place.
  onlyQuotesChange: onlyParseDiffers,
  telemetry: searchTelemetry({ delayMs: SEARCH_RECORD_DELAY_MS, send: trackSearchExecute }),
  extra: meanings,
});

export const searchTool = tanakhSearch.tool;

/** Hand search the verses, and what a result click does with one. */
export function configure(config: {
  verses: TanakhLayout[];
  callbacks?: { onVerseClick?: (verse: TanakhLayout) => void };
}): void {
  tanakhSearch.configure(config.verses, config.callbacks?.onVerseClick ?? (() => {}));
}

/**
 * The search with a word a reader clicked added to it, narrowed to one of its
 * meanings, or null when the palette is full, so the caller can say so rather
 * than dropping the click silently.
 *
 * Adds a term rather than replacing the search: the existing words keep their
 * colours, which is what makes two words comparable on one map.
 *
 * The click settles how that word is matched, and only that word: a meaning in
 * meanings mode, and the written form as a whole word, since substring would
 * find it inside longer words and meanings would bring back the readings the
 * reader declined.
 *
 * The meaning arrives as every lexeme its row stands for, not as one key. The
 * reader chose from a list the verse built, and a row the verse built can be
 * headed by a different lexeme than the same row in the term's own list, so a
 * single key would be a key this term does not answer to.
 */
export function searchForMeaning(
  dictionary: Dictionary,
  settings: SearchSettings,
  text: string,
  meaningKeys: readonly string[] | null,
): SearchSettings | null {
  const chosen = meaningKeys && meaningKeys.length > 0 ? meaningKeys : null;
  const spelling = chosen ? (spellingFor(dictionary, chosen, text) ?? text) : text;
  return tanakhSearch.addTermOrFill(settings, spelling, chosen ? meaningsMode.id : 'word', chosen);
}
