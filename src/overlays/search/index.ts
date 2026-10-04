// The full-text search: the search a term list describes, and the members the
// app draws, colours and links it through.
//
// The term list is the overlay's settings, and the app holds it: every member
// here is handed the list and none keeps one. The three parts it draws with are
// modules of their own — termRows.ts, resultsList.ts and highlight.ts — and
// each is handed what it needs. Which row the reader is working in is
// presentation, not a setting, so it stays here.
import './search.css';
import type { Overlay, Color, UrlParamValues } from '../types.ts';
import type { TanakhIdentity, TanakhLayout } from '../../types.ts';
import { HEBREW, tanakhKey } from '../../types.ts';
import {
  getMatchingVerseTerms,
  parseSearchTerms,
  type Dictionary,
  type SearchResult,
  type TextIndex,
} from '../../search.ts';
import { dictionaryOf, SEARCH_FILES, textIndexOf, type SearchData } from '../../search/data.ts';
import { spellingFor, versesFor, wordsOfVerse } from '../../search/dictionary.ts';
import { excerpt, highlightTerms } from './highlight.ts';
import {
  renderResults as renderResultsList,
  requoteResults,
  detachResults,
  type ResultsView,
} from './resultsList.ts';
import { mountTermRows, renderTermRows, unmountTermRows, type TermRowsHost } from './termRows.ts';
export { focusSearchBox } from './termRows.ts';
import {
  addTerm,
  chosenMeanings,
  colorIndexAt,
  setTermText,
  onlyMeaning,
  encodeMeanings,
  applyMeanings,
  setMode,
  effectiveMode,
  resultsForTerms,
  encodeModes,
  applyModes,
  MAX_TERMS,
  type SearchTerm,
} from '../../search/terms.ts';
import { SEARCH_COLORS, colorToCss } from '../../utils/color.ts';
import { isSearchableWord } from '../../hebrew.ts';
import { SEARCH_URL_PARAMS } from '@torahmap/link';
import { memoByValue } from '../../utils/memo.ts';

/**
 * A list of terms, each with its own text, its own meanings, its own colour and
 * its own way of being matched. There is always at least one, possibly empty,
 * so the panel always has somewhere to type.
 *
 * A term's colour is not in the URL: it survives a neighbour being removed, so
 * the list itself is the setting rather than the URL values it is written as.
 */
export interface SearchSettings {
  readonly terms: SearchTerm[];
}

let verses: TanakhLayout[] = [];
/** The row the reader last opened. Read through `openTerm`. */
let openTermId: string | null = null;

let onVerseClickCallback: ((verse: TanakhLayout) => void) | null = null;

/** What a term list finds: the terms searched, and the verses they match. */
interface Search {
  /** The terms the search actually runs, in order (see activeTerms). */
  active: SearchTerm[];
  results: SearchResult[];
  /** Verse key to the positions, among the searched terms, of the terms it matches. */
  matchingTerms: Map<string, number[]>;
}

/** The terms the search runs: those holding a word, not a single letter. */
export function activeTerms(settings: SearchSettings): SearchTerm[] {
  return settings.terms.filter((t) => isSearchableWord(t.text));
}

// Per text index and dictionary, then per settings: the same settings with
// another dictionary are another search. Every function in terms.ts returns a
// new list, so settings are never edited in place.
const searches = memoByValue((index: TextIndex) =>
  memoByValue((dictionary: Dictionary) =>
    memoByValue((settings: SearchSettings): Search => {
      const active = activeTerms(settings);
      return { active, ...matchesForTerms(index, dictionary, active) };
    }),
  ),
);

const NO_SEARCH: Search = { active: [], results: [], matchingTerms: new Map() };

/** The search these settings run; with no word typed, the empty one, building nothing. */
function searchFor(data: SearchData, settings: SearchSettings): Search {
  if (typedTerms(settings).length === 0) return NO_SEARCH;
  return searches(textIndexOf(data))(dictionaryOf(data))(settings);
}

/** Terms holding something, including ones too short to search on. */
function typedTerms(settings: SearchSettings): SearchTerm[] {
  return settings.terms.filter((t) => t.text.trim().length > 0);
}

/**
 * The row the reader is working in: the one they opened while it still exists,
 * otherwise the first.
 *
 * Derived on every read rather than repaired in one place, so the list, the
 * caption and the rows cannot disagree about which row is open depending on
 * the order they are drawn in. A restored list has new ids, so it opens on its
 * first row without anything resetting the choice.
 */
function openTerm(settings: SearchSettings): SearchTerm | undefined {
  return settings.terms.find((t) => t.id === openTermId) ?? settings.terms[0];
}

/**
 * Where the open row's term sits among the terms being searched, or -1 when
 * that row has nothing to search on — an empty box, or a single letter.
 *
 * Results name a term by its position in the searched list, which is not its
 * position among the rows on screen.
 */
function openTermIndex(settings: SearchSettings): number {
  const open = openTerm(settings);
  return open ? activeTerms(settings).indexOf(open) : -1;
}

/**
 * The verses the list shows: the ones the open row's word accounts for.
 *
 * A row with nothing to search on narrows nothing, or clicking "add a word"
 * would empty the list.
 */
function resultsForOpenRow(data: SearchData, settings: SearchSettings): SearchResult[] {
  const { results } = searchFor(data, settings);
  const index = openTermIndex(settings);
  if (index === -1) return results;

  return results.filter((result) => result.matchingTerms.some((m) => m.termIndex === index));
}

type SettingsChange = (update: (current: SearchSettings) => SearchSettings) => void;

// The controls on screen: their elements, where they send a change, and the
// settings they show. `shown` is display state, for redrawing the rows when the
// reader opens one; a change is always worked out from the settings the app
// holds when it applies it, never from `shown`.
let searchResults: HTMLDivElement | null = null;
let searchHitCaption: HTMLDivElement | null = null;
let searchClear: HTMLButtonElement | null = null;
let requestChange: SettingsChange | null = null;
let shown: SearchSettings | null = null;
let shownData: SearchData | null = null;

export function configure(config: {
  verses: TanakhLayout[];
  callbacks?: { onVerseClick?: (verse: TanakhLayout) => void };
}): void {
  verses = config.verses;
  if (config.callbacks?.onVerseClick) {
    onVerseClickCallback = config.callbacks.onVerseClick;
  }
}

/**
 * The verses these terms find, and nothing else: no state, no DOM, no analytics.
 *
 * A Hebrew term in meanings mode finds the verses of the meanings the reader has
 * left checked; every other term matches its text, in its own language.
 */
export function matchesForTerms(
  index: TextIndex,
  dictionary: Dictionary,
  active: SearchTerm[],
): Omit<Search, 'active'> {
  if (active.length === 0) return { results: [], matchingTerms: new Map() };

  const results = resultsForTerms(index, dictionary, active);
  return { results, matchingTerms: getMatchingVerseTerms(results) };
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
  if (!canAddTerm(settings)) return null;

  // The list always holds one empty row to type into. Fill it rather than
  // leaving an empty row above the new word. setTermText replaces a term in
  // place, so the filled row keeps its position - track it by id rather than
  // assuming it lands last, which is wrong whenever the empty row was not the
  // last one (a reader who cleared an earlier box while a later one still
  // held a word).
  const chosen = meaningKeys && meaningKeys.length > 0 ? meaningKeys : null;
  const spelling = chosen ? (spellingFor(dictionary, chosen, text) ?? text) : text;
  let terms = settings.terms;
  const empty = terms.find((term) => term.text.trim() === '');
  let id: string;
  if (empty) {
    id = empty.id;
    terms = setTermText(terms, id, spelling);
  } else {
    terms = addTerm(terms, spelling);
    id = terms[terms.length - 1].id;
  }

  if (chosen) {
    terms = setMode(terms, id, 'meanings');
    terms = onlyMeaning(terms, id, chosen);
  } else {
    terms = setMode(terms, id, 'word');
  }

  // The word the click just added is the one the reader is looking at.
  openTermId = id;
  return { terms };
}

/**
 * Is there a colour left for another word?
 *
 * Asked before a click is offered, so the panel can say the palette is full
 * rather than showing a button that would quietly do nothing.
 */
export function canAddTerm(settings: SearchSettings): boolean {
  return typedTerms(settings).length < MAX_TERMS;
}

/**
 * How many verses one term accounts for on its own, or null when it is not
 * being searched.
 *
 * Takes the term, not a row number. Results are indexed by a term's position
 * among the terms actually being searched, which is not its position among the
 * rows on screen — a row holding nothing, or one letter, occupies a row but no
 * search slot. Indexing by row instead gives a row its neighbour's count as
 * soon as an earlier row is emptied.
 */
export function termHitCount(
  data: SearchData,
  settings: SearchSettings,
  term: SearchTerm,
): number | null {
  const { active, results } = searchFor(data, settings);
  const index = active.indexOf(term);
  if (index === -1) return null;

  let count = 0;
  for (const result of results) {
    if (result.matchingTerms.some((m) => m.termIndex === index)) count++;
  }
  return count;
}

/**
 * The one number the term rows cannot show: how many verses the search finds
 * altogether. Each row carries its own count; this is their union.
 */
function updateHitCaption(settings: SearchSettings, data: SearchData | null): void {
  if (!searchHitCaption) return;
  if (!data) {
    searchHitCaption.textContent = '';
    return;
  }
  const { active, results } = searchFor(data, settings);
  const listed = resultsForOpenRow(data, settings).length;

  let message: string;
  if (active.length > 0 && results.length > 0) {
    // The list shows the open row's verses, so the caption above it counts
    // those, and names the union second so the number the rows cannot show
    // between them is still somewhere. With one term the two are the same
    // number and saying it twice would be noise.
    message =
      listed === results.length
        ? `${results.length} matching verses`
        : `${listed} of ${results.length} matching verses`;
  } else if (active.length > 0) {
    message = 'No matching verses';
  } else if (typedTerms(settings).length > 0) {
    message = 'Type at least 2 characters per term';
  } else {
    message = 'Type to search';
  }

  searchHitCaption.textContent = message;
}

/** Redraw the list of verses for the row the reader is working in. */
function renderResults(settings: SearchSettings, data: SearchData | null): void {
  if (!searchResults) return;

  if (!data) {
    renderResultsList(searchResults, {
      results: [],
      terms: [],
      focus: -1,
      onSelect: showVerse,
      snippet: () => null,
    });
    return;
  }

  renderResultsList(searchResults, {
    results: resultsForOpenRow(data, settings),
    terms: searchFor(data, settings).active,
    focus: openTermIndex(settings),
    onSelect: showVerse,
    snippet: snippetFor(data),
  });
}

function snippetFor(data: SearchData): ResultsView['snippet'] {
  return (result, term) => excerpt(result, term, textIndexOf(data), dictionaryOf(data), data.parse);
}

/**
 * Quote the results already listed again from `data`, which differs from the
 * panel's only in the per-word parse: it marks a word better than its spelling.
 */
export function requoteSearchResults(data: SearchData): void {
  if (!searchResults) return;
  shownData = data;
  requoteResults(searchResults, snippetFor(data));
}

/**
 * Make this row the one the reader is working in.
 *
 * The list and the caption follow the open row, so both are redrawn — without
 * rerunning the search, which has not changed.
 */
function openRow(id: string): void {
  openTermId = id;
  if (!shown) return;
  renderTermRows();
  renderResults(shown, shownData);
  updateHitCaption(shown, shownData);
}

/**
 * What the term rows are allowed to ask of the search.
 *
 * Narrow and one-way on purpose. The rows draw the term list they are shown
 * and ask for changes to it; the app applies each change to the list it holds.
 */
const termRowsHost: TermRowsHost = {
  terms: () => shown?.terms ?? [],
  openId: () => (shown ? (openTerm(shown)?.id ?? null) : null),
  dictionary: () =>
    shown && shownData && typedTerms(shown).length > 0 ? dictionaryOf(shownData) : null,
  hitCount: (term) => (shown && shownData ? termHitCount(shownData, shown, term) : null),
  edit(change) {
    requestChange?.((current) => ({ terms: change(current.terms) }));
  },
  openRow,
  addRow() {
    requestChange?.((current) => {
      const terms = addTerm(current.terms, '');
      openTermId = terms[terms.length - 1].id;
      return { terms };
    });
  },
};

/** Hand a clicked result back to the app as the verse it names. */
function showVerse(result: SearchResult): void {
  const verse = verses.find(
    (v) => v.book === result.book && v.chapter === result.chapter && v.verse === result.verse,
  );
  if (verse && onVerseClickCallback) {
    onVerseClickCallback(verse);
  }
}

/**
 * A verse's colour given what a term list found: each matching term's own
 * colour, split corner to corner when there are several.
 */
function searchColorAt(verse: TanakhIdentity, search: Search): Color | Color[] | null {
  const termIndices = search.matchingTerms.get(tanakhKey(verse.book, verse.chapter, verse.verse));
  if (!termIndices || termIndices.length === 0) return null;

  const colors = termIndices.map((i) => SEARCH_COLORS[colorIndexAt(search.active, i)]);
  return colors.length === 1 ? colors[0] : colors;
}

/** The term list a link describes, with its modes and meanings laid over it. */
function settingsFromUrl(params: UrlParamValues<typeof SEARCH_URL_PARAMS>): SearchSettings {
  let terms = parseSearchTerms(params.search ?? '').reduce(addTerm, [] as SearchTerm[]);
  if (terms.length === 0) terms = addTerm([], '');
  if (params.mode) terms = applyModes(terms, params.mode);
  if (params.m) terms = applyMeanings(terms, params.m);
  return { terms };
}

/** Whether the search has a term it searches on. */
export function isSearching(settings: SearchSettings): boolean {
  return activeTerms(settings).length > 0;
}

export const searchTool: Overlay<TanakhIdentity, SearchSettings, SearchData> = {
  id: 'search',
  name: 'Search',
  tagline: 'Search for any word, Hebrew or English',
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

  data: SEARCH_FILES,

  prebuild(data) {
    textIndexOf(data);
    dictionaryOf(data);
  },

  getVerseColor(verse, settings, data) {
    return searchColorAt(verse, searchFor(data, settings));
  },

  colorsFor(items, settings, _hovered, data) {
    const search = searchFor(data, settings);
    return items.map((item) => searchColorAt(item, search));
  },

  urlParams: SEARCH_URL_PARAMS,

  settingsFromUrl,

  summary(settings) {
    return {
      terms: activeTerms(settings).map((t) => ({
        text: t.text.trim(),
        color: colorToCss(SEARCH_COLORS[t.colorIndex]),
      })),
    };
  },

  settingsToUrl(settings) {
    const active = activeTerms(settings);
    const params: Record<string, string> = {};
    const query = active.map((t) => t.text).join(', ');
    if (query) {
      params.search = query;
      // Both are positional over the same list, so they are written together
      // and a term that has chosen nothing contributes an empty entry rather
      // than being skipped — skipping it would shift every later term.
      const modes = encodeModes(active);
      if (modes) params.mode = modes;

      const meanings = encodeMeanings(active);
      if (meanings) params.m = meanings;
    }
    return params;
  },

  renderControls(container, settings, onChange, data) {
    const previous = shown;
    const previousData = shownData;
    shown = settings;
    shownData = data;
    requestChange = onChange;

    if (!searchResults || !container.contains(searchResults)) {
      container.innerHTML = `
        <div id="search-terms"></div>
        <div class="search-actions">
          <button type="button" id="add-term">+ add a word</button>
          <button type="button" id="search-clear-all">Clear</button>
        </div>
        <div id="search-hit-caption"></div>
        <div id="search-results"></div>
      `;

      searchHitCaption = container.querySelector('#search-hit-caption');
      searchResults = container.querySelector('#search-results');
      searchClear = container.querySelector('#search-clear-all');
      searchClear?.addEventListener('click', () =>
        requestChange?.(() => ({ terms: addTerm([], '') })),
      );

      mountTermRows(
        {
          container: container.querySelector('#search-terms'),
          addTermButton: container.querySelector('#add-term'),
        },
        termRowsHost,
      );
    } else if (settings === previous && data === previousData) {
      // Nothing has changed, and redrawing the list would scroll it to the top.
      return;
    }

    renderTermRows();
    updateHitCaption(settings, data);
    renderResults(settings, data);
    if (searchClear) searchClear.disabled = typedTerms(settings).length === 0;
  },

  getHoverInfo(verse, settings, data) {
    const { active, matchingTerms } = searchFor(data, settings);
    if (active.length === 0) return null;

    const key = tanakhKey(verse.book, verse.chapter, verse.verse);
    const termIndices = matchingTerms.get(key);
    if (!termIndices) return null;

    // Each word as typed, then which of its checked meanings this verse holds.
    const dictionary = dictionaryOf(data);
    const named = termIndices.map((i) => {
      const term = active[i];
      if (effectiveMode(dictionary, term) !== 'meanings') return term.text;
      const here = chosenMeanings(dictionary, term)
        .filter((m) => versesFor(dictionary, m.keys).has(key))
        .map((m) => m.gloss);
      return `${term.text} (${here.join(', ')})`;
    });

    return `Matches: ${named.join(', ')}`;
  },

  destroy(): void {
    detachResults(searchResults);
    unmountTermRows();
    searchResults = null;
    searchHitCaption = null;
    searchClear = null;
    shown = null;
    shownData = null;
    requestChange = null;
  },

  highlightVerseText(verse, text, language, settings, data) {
    const words =
      language === HEBREW
        ? wordsOfVerse(data.parse, tanakhKey(verse.book, verse.chapter, verse.verse), text)
        : null;
    return highlightTerms(
      text,
      language,
      searchFor(data, settings).active,
      dictionaryOf(data),
      words,
    );
  },
};
