// The full-text search overlay: the search a term list describes, and the
// overlay interface the app sees.
//
// The term list is the overlay's settings, and the app holds it: every member
// here is handed the list and none keeps one. The three parts it draws with are
// modules of their own — termRows.ts, resultsList.ts and highlight.ts — and
// each is handed what it needs. Which row the reader is working in is
// presentation, not a setting, so it stays here.
import '../../styles/overlays/search.css';
import type { Overlay, Color, UrlParamSpec, UrlParamValues } from '../types.ts';
import type { TanakhIdentity, TanakhLayout, TextLanguage } from '../../types.ts';
import { tanakhKey } from '../../types.ts';
import {
  getMatchingVerseTerms,
  parseSearchTerms,
  resultsForVerseSets,
  verseSetsForTerms,
  type SearchResult,
} from '../../search.ts';
import { versesFor } from '../../search/dictionary.ts';
import { highlightTerms } from './highlight.ts';
import { renderResults as renderResultsList, detachResults } from './resultsList.ts';
import { mountTermRows, renderTermRows, unmountTermRows, type TermRowsHost } from './termRows.ts';
import {
  addTerm,
  colorIndexAt,
  setTermText,
  onlyMeaning,
  encodeMeanings,
  applyMeanings,
  setMode,
  meaningsApply,
  termQuery,
  encodeModes,
  applyModes,
  MAX_TERMS,
  type SearchTerm,
  type TermQuery,
} from '../../search/terms.ts';
import { SEARCH_COLORS } from '../../utils/color.ts';
import { MIN_SEARCH_TERM_LENGTH, SEARCH_RECORD_DELAY_MS } from '../../constants/app.ts';
import { debounce } from '../../utils/debounce.ts';
import { termsToRecord, type Recorded } from './recording.ts';
import { HIGHLIGHT_CONSTANTS } from '../../constants.ts';
import { trackSearchExecute } from '../../analytics.ts';

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

const URL_PARAMS = [
  { key: 'q', kind: 'text' },
  // Positional across the terms in q, one letter each, and an empty entry for
  // a term still on its default (see MODE_LETTERS in terms.ts).
  { key: 'mode', kind: 'token' },
  { key: 'm', kind: 'names' },
] as const satisfies readonly UrlParamSpec[];

let onVerseClickCallback: ((verse: TanakhLayout) => void) | null = null;

/** What a term list finds: the terms searched, and the verses they match. */
interface Search {
  /**
   * The terms the search actually runs, in order. Short ones are left out for
   * the same reason parseSearchTerms drops them: a single letter matches most
   * of the corpus and is almost never meant.
   */
  active: SearchTerm[];
  results: SearchResult[];
  /** Verse key to the positions, among the searched terms, of the terms it matches. */
  matchingTerms: Map<string, number[]>;
}

// getVerseColor asks once per verse, 23,000 times a paint, so the search is run
// once per settings value and kept. Settings are never edited in place — every
// function in terms.ts returns a new list — so a value's identity is a sound
// key. The last one asked about is checked first, because a paint asks about
// the same one every time.
const searches = new WeakMap<SearchSettings, Search>();
let lastSearch: { of: SearchSettings; value: Search } | null = null;

function searchFor(settings: SearchSettings): Search {
  if (lastSearch?.of === settings) return lastSearch.value;

  let value = searches.get(settings);
  if (!value) {
    const active = settings.terms.filter((t) => t.text.trim().length >= MIN_SEARCH_TERM_LENGTH);
    value = { active, ...matchesForTerms(active) };
    searches.set(settings, value);
  }
  lastSearch = { of: settings, value };
  return value;
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
  return open ? searchFor(settings).active.indexOf(open) : -1;
}

/**
 * The verses the list shows: the ones the open row's word accounts for.
 *
 * A row with nothing to search on narrows nothing, or clicking "add a word"
 * would empty the list.
 */
function resultsForOpenRow(settings: SearchSettings): SearchResult[] {
  const { results } = searchFor(settings);
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
let requestChange: SettingsChange | null = null;
let shown: SearchSettings | null = null;

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
 * Two paths, because the modes genuinely differ. In meanings mode over Hebrew each
 * term contributes the verses of the meanings the reader has left checked, so
 * the choice is what drives the result. Every other mode still matches text,
 * and search() does that as it always has.
 */
function matchesForTerms(active: SearchTerm[]): Omit<Search, 'active'> {
  if (active.length === 0) return { results: [], matchingTerms: new Map() };

  // Every term is matched on its own, in its own language. Matching text scans
  // the corpus, so it is done only for the terms that need it — a Hebrew term
  // answered from the dictionary never pays for it.
  const textVerses = ({ text, mode }: TermQuery): Set<string> =>
    verseSetsForTerms([text], {
      wholeWordEnglish: mode === 'word',
      // A Hebrew term reaches this path in meanings mode only when the
      // dictionary has nothing for it, and meanings falls back to whole word.
      hebrewMode: mode === 'meanings' ? 'word' : mode,
    })[0];

  const queries = active.map(termQuery);
  const results = resultsForVerseSets(
    queries.map((query) => (query.meaningKeys ? versesFor(query.meaningKeys) : textVerses(query))),
    queries.map((query) => query.language),
  );

  return { results, matchingTerms: getMatchingVerseTerms(results) };
}

let recorded: Recorded = new Map();
/** The search the reader's last change produced. */
let lastChanged: SearchSettings | null = null;

const recordSettledSearch = debounce(() => {
  const settings = lastChanged;
  if (!settings) return;

  const { send, recorded: next } = termsToRecord(recorded, searchFor(settings).active);
  recorded = next;
  for (const term of send) {
    const { language, mode } = termQuery(term);
    trackSearchExecute(term.text, language, mode, termHitCount(settings, term)!);
  }
}, SEARCH_RECORD_DELAY_MS);

/**
 * Take `settings` as the search on the map. One the reader's last change did
 * not produce came from a link: a word still waiting to be recorded is dropped,
 * and the link's terms count as recorded, so a restored word is never sent as
 * though the reader had typed it and the next event names only what they
 * change.
 */
function searchOnMap(settings: SearchSettings): void {
  if (settings === lastChanged) return;
  recordSettledSearch.cancel();
  recorded = termsToRecord(new Map(), searchFor(settings).active).recorded;
  lastChanged = settings;
}

/**
 * Note a change the reader made, from `current` to `next`, and return `next`,
 * to be recorded once the search has sat unchanged for SEARCH_RECORD_DELAY_MS.
 */
function readerChanged(current: SearchSettings, next: SearchSettings): SearchSettings {
  searchOnMap(current);
  lastChanged = next;
  recordSettledSearch();
  return next;
}

/**
 * The search with a word a reader clicked added to it, narrowed to one of its
 * meanings, or null when the palette is full, so the caller can say so rather
 * than dropping the click silently.
 *
 * Adds a term rather than replacing the search: the existing words keep their
 * colours, which is what makes two words comparable on one map.
 *
 * Either way the click settles how that word is matched, and only that word. A
 * meaning can only be searched for in meanings mode — "the burnt-offering reading"
 * cannot be expressed as a substring. The written form is the opposite
 * request, for this spelling and no other, so it goes to whole word: substring
 * would match it inside longer words, and meanings would resolve a known spelling
 * to its dictionary entry and find the readings the reader just declined.
 * Neighbouring terms keep whatever they were doing.
 *
 * The meaning arrives as every lexeme its row stands for, not as one key. The
 * reader chose from a list the verse built, and a row the verse built can be
 * headed by a different lexeme than the same row in the term's own list, so a
 * single key would be a key this term does not answer to.
 */
export function searchForMeaning(
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
  let terms = settings.terms;
  const empty = terms.find((term) => term.text.trim() === '');
  let id: string;
  if (empty) {
    id = empty.id;
    terms = setTermText(terms, id, text);
  } else {
    terms = addTerm(terms, text);
    id = terms[terms.length - 1].id;
  }

  if (meaningKeys && meaningKeys.length > 0) {
    terms = setMode(terms, id, 'meanings');
    terms = onlyMeaning(terms, id, meaningKeys);
  } else {
    terms = setMode(terms, id, 'word');
  }

  // The word the click just added is the one the reader is looking at.
  openTermId = id;
  return readerChanged(settings, { terms });
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
function termHitCount(settings: SearchSettings, term: SearchTerm): number | null {
  const { active, results } = searchFor(settings);
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
function updateHitCaption(settings: SearchSettings): void {
  if (!searchHitCaption) return;

  const { active, results } = searchFor(settings);
  const listed = resultsForOpenRow(settings).length;

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
function renderResults(settings: SearchSettings): void {
  if (!searchResults) return;

  renderResultsList(searchResults, {
    results: resultsForOpenRow(settings),
    terms: searchFor(settings).active,
    focus: openTermIndex(settings),
    onSelect: showVerse,
  });
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
  renderResults(shown);
  updateHitCaption(shown);
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
  hitCount: (term) => (shown ? termHitCount(shown, term) : null),
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
 * colour, stippled when there are several, or dimmed grey when none match.
 */
function searchColorAt(verse: TanakhIdentity, search: Search): Color | Color[] | null {
  const { active, matchingTerms } = search;
  if (active.length === 0) return null;

  const termIndices = matchingTerms.get(tanakhKey(verse.book, verse.chapter, verse.verse));

  if (termIndices && termIndices.length > 0) {
    const colors = termIndices.map((i) => SEARCH_COLORS[colorIndexAt(active, i)]);
    if (colors.length === 1) {
      return colors[0];
    }
    // Stipple effect for multiple matches, capped at 4 colors.
    return colors.slice(0, 4) as Color[];
  }

  const brightness = (0.4 + 0.2) * HIGHLIGHT_CONSTANTS.DIM_FACTOR;
  return [brightness, brightness, brightness];
}

/** The term list a link describes, with its modes and meanings laid over it. */
function settingsFromUrl(params: UrlParamValues<typeof URL_PARAMS>): SearchSettings {
  let terms = parseSearchTerms(params.q ?? '').reduce(addTerm, [] as SearchTerm[]);
  if (terms.length === 0) terms = addTerm([], '');
  if (params.mode) terms = applyModes(terms, params.mode);
  if (params.m) terms = applyMeanings(terms, params.m);
  return { terms };
}

/** The verse text, with every searched term marked in its own colour. */
export function highlightSearchTerms(
  text: string,
  language: TextLanguage,
  settings: SearchSettings,
): DocumentFragment {
  return highlightTerms(text, language, searchFor(settings).active);
}

export const searchOverlay: Overlay<TanakhIdentity, SearchSettings> = {
  id: 'search',
  name: 'Text Search',
  description:
    'Lights up every verse holding the word you type, in the Hebrew or in the English. ' +
    'Matches the letters you typed, or the dictionary words that spelling can be.',
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

  getVerseColor(verse, settings) {
    return searchColorAt(verse, searchFor(settings));
  },

  colorsFor(items, settings, _hovered) {
    const search = searchFor(settings);
    return items.map((item) => searchColorAt(item, search));
  },

  defaultSettings() {
    return { terms: addTerm([], '') };
  },

  urlParams: URL_PARAMS,

  settingsFromUrl,

  settingsToUrl(settings) {
    const { active } = searchFor(settings);
    const params: Record<string, string> = {};
    const query = active.map((t) => t.text).join(', ');
    if (query) {
      params.q = query;
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

  renderControls(container, settings, onChange) {
    const previous = shown;
    shown = settings;
    searchOnMap(settings);
    // Every change the panel asks for is the reader's.
    requestChange = (update) => onChange((current) => readerChanged(current, update(current)));

    if (!searchResults || !container.contains(searchResults)) {
      container.innerHTML = `
        <div id="search-terms"></div>
        <button type="button" id="add-term">+ add a word</button>
        <div id="search-hit-caption"></div>
        <div id="search-results"></div>
      `;

      searchHitCaption = container.querySelector('#search-hit-caption');
      searchResults = container.querySelector('#search-results');

      mountTermRows(
        {
          container: container.querySelector('#search-terms'),
          addTermButton: container.querySelector('#add-term'),
        },
        termRowsHost,
      );
    } else if (settings === previous) {
      // Nothing has changed, and redrawing the list would scroll it to the top.
      return;
    }

    renderTermRows();
    updateHitCaption(settings);
    renderResults(settings);
  },

  getHoverInfo(verse, settings) {
    const { active, matchingTerms } = searchFor(settings);
    if (active.length === 0) return null;

    const key = tanakhKey(verse.book, verse.chapter, verse.verse);
    const termIndices = matchingTerms.get(key);
    if (!termIndices) return null;

    // Each word as typed, then which of its checked meanings this verse holds.
    const named = termIndices.map((i) => {
      const term = active[i];
      if (!meaningsApply(term)) return term.text;
      const here = term.meanings
        .filter((m) => term.selected.has(m.keys[0]) && versesFor(m.keys).has(key))
        .map((m) => m.gloss);
      return here.length > 0 ? `${term.text} (${here.join(', ')})` : term.text;
    });

    return `Matches: ${named.join(', ')}`;
  },

  destroy(): void {
    detachResults(searchResults);
    unmountTermRows();
    searchResults = null;
    searchHitCaption = null;
    shown = null;
    requestChange = null;
    // A search the reader leaves before it settles is not recorded.
    recordSettledSearch.cancel();
    // verses and onVerseClickCallback are configuration handed in once by
    // configure(), not per-activation state, so they stay.
  },

  highlightVerseText(text, language, settings) {
    return highlightSearchTerms(text, language, settings);
  },
};
