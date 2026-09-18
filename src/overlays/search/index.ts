// The full-text search overlay: the terms it holds, the search it runs on them,
// and the overlay interface the app sees.
//
// The three parts it draws with are modules of their own — termRows.ts,
// resultsList.ts and highlight.ts — and each is handed what it needs, so this
// is the only file holding the term list, the results, and which row the reader
// is working in.
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
  selectedKeys,
  encodeMeanings,
  applyMeanings,
  setMode,
  effectiveMode,
  meaningsApply,
  termIsHebrew,
  encodeModes,
  applyModes,
  MAX_TERMS,
  type SearchTerm,
} from '../../search/terms.ts';
import { SEARCH_COLORS } from '../../utils/color.ts';
import { MIN_SEARCH_TERM_LENGTH } from '../../constants/app.ts';
import { HIGHLIGHT_CONSTANTS } from '../../constants.ts';
import { trackSearchExecute } from '../../analytics.ts';

let verses: TanakhLayout[] = [];
// The search is a list of terms, each with its own text, its own meanings, its
// own colour and its own way of being matched. There is always at least one,
// possibly empty, so the panel always has somewhere to type.
let terms: SearchTerm[] = [];
let currentResults: SearchResult[] = [];
let matchingTerms = new Map<string, number[]>();
/** The row the reader last opened. Read through `openTerm`. */
let openTermId: string | null = null;

const URL_PARAMS = [
  { key: 'q', kind: 'text' },
  // Positional across the terms in q, one letter each, and an empty entry for
  // a term still on its default (see MODE_LETTERS in terms.ts).
  { key: 'mode', kind: 'token' },
  { key: 'm', kind: 'names' },
] as const satisfies readonly UrlParamSpec[];

let updateCallback: (() => void) | null = null;
let onVerseClickCallback: ((verse: TanakhLayout) => void) | null = null;

/**
 * The terms the search will actually run, in order.
 *
 * Short ones are left out for the same reason parseSearchTerms drops them: a
 * single letter matches most of the corpus and is almost never meant.
 *
 * The answer is kept until the term list is replaced. getVerseColor asks once
 * per verse, so applyOverlay asks 23,000 times, and it runs on every hover
 * change — filtering the list that often was enough work to show in a frame.
 * Every function in terms.ts returns a new list rather than editing one, so
 * the identity of `terms` is a sound thing to hang the answer on.
 */
let activeTermsCache: { of: SearchTerm[]; value: SearchTerm[] } | null = null;

function searchable(list: SearchTerm[]): SearchTerm[] {
  return list.filter((t) => t.text.trim().length >= MIN_SEARCH_TERM_LENGTH);
}

function activeTerms(): SearchTerm[] {
  if (activeTermsCache?.of !== terms) {
    activeTermsCache = { of: terms, value: searchable(terms) };
  }
  return activeTermsCache.value;
}

/** Terms holding something, including ones too short to search on. */
function typedTerms(): SearchTerm[] {
  return terms.filter((t) => t.text.trim().length > 0);
}

function currentQuery(): string {
  return activeTerms()
    .map((t) => t.text)
    .join(', ');
}

/**
 * The row the reader is working in: the one they opened while it still exists,
 * otherwise the first.
 *
 * Derived on every read rather than repaired in one place, so the list, the
 * caption and the rows cannot disagree about which row is open depending on
 * the order they are drawn in.
 */
function openTerm(): SearchTerm | undefined {
  return terms.find((t) => t.id === openTermId) ?? terms[0];
}

/**
 * Where the open row's term sits among the terms being searched, or -1 when
 * that row has nothing to search on — an empty box, or a single letter.
 *
 * Results name a term by its position in the searched list, which is not its
 * position among the rows on screen.
 */
function openTermIndex(): number {
  const open = openTerm();
  return open ? activeTerms().indexOf(open) : -1;
}

/**
 * The verses the list shows: the ones the open row's word accounts for.
 *
 * A row with nothing to search on narrows nothing, or clicking "add a word"
 * would empty the list.
 */
function resultsForOpenRow(): SearchResult[] {
  const index = openTermIndex();
  if (index === -1) return currentResults;

  return currentResults.filter((result) => result.matchingTerms.some((m) => m.termIndex === index));
}

let searchResults: HTMLDivElement | null = null;
let searchHitCaption: HTMLDivElement | null = null;

export function configure(config: {
  verses: TanakhLayout[];
  callbacks?: { onVerseClick?: (verse: TanakhLayout) => void };
}): void {
  verses = config.verses;
  if (config.callbacks?.onVerseClick) {
    onVerseClickCallback = config.callbacks.onVerseClick;
  }
}

interface SearchMatches {
  results: SearchResult[];
  /** Verse key to the positions, among the searched terms, of the terms it matches. */
  matchingTerms: Map<string, number[]>;
}

/**
 * The verses these terms find, and nothing else: no state, no DOM, no analytics.
 *
 * Two paths, because the modes genuinely differ. In meanings mode over Hebrew each
 * term contributes the verses of the meanings the reader has left checked, so
 * the choice is what drives the result. Every other mode still matches text,
 * and search() does that as it always has.
 */
function matchesForTerms(active: SearchTerm[]): SearchMatches {
  if (active.length === 0) return { results: [], matchingTerms: new Map() };

  // Every term is matched on its own, in its own language. Only a Hebrew term
  // in meanings mode consults the chosen meanings; everything else is text.
  // Matching text scans the corpus, so it is done only for the terms that need
  // it — a Hebrew term answered from the dictionary never pays for it.
  const textVerses = (term: SearchTerm): Set<string> => {
    const mode = effectiveMode(term);
    return verseSetsForTerms([term.text.trim()], {
      wholeWordEnglish: mode === 'word',
      // A Hebrew term reaches this path only when the dictionary has nothing
      // for it, and meanings has always fallen back to whole word there.
      hebrewMode: mode === 'meanings' ? 'word' : mode,
    })[0];
  };

  const results = resultsForVerseSets(
    active.map((term) => {
      if (!meaningsApply(term)) return textVerses(term);
      // A term the dictionary does not know falls back to whole-word matching,
      // as meanings mode always has. Meanings is the default now, so a lexeme index
      // that failed to load must not mean Hebrew silently finds nothing.
      return term.meanings.length > 0 ? versesFor(selectedKeys(term)) : textVerses(term);
    }),
    active.map((term) => (termIsHebrew(term) ? 'he' : 'en')),
  );

  return { results, matchingTerms: getMatchingVerseTerms(results) };
}

/**
 * Run the search the current terms describe, and repaint.
 *
 * The analytics event is sent here and not in matchesForTerms: it records a
 * reader searching, not a colour being computed.
 */
function runSearch(): void {
  const active = activeTerms();
  ({ results: currentResults, matchingTerms } = matchesForTerms(active));

  for (const term of active) {
    const hebrew = termIsHebrew(term);
    trackSearchExecute(term.text, hebrew ? 'he' : 'en', effectiveMode(term), currentResults.length);
  }

  renderResults();
  renderTermRows();
  updateHitCaption();
  updateCallback?.();
}

/**
 * Search for a word a reader clicked, narrowed to one of its meanings.
 *
 * Adds a term rather than replacing the search: the existing words keep their
 * colours, which is what makes two words comparable on one map. Returns false
 * when the palette is full, so the caller can say so rather than dropping the
 * click silently.
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
export function searchForMeaning(text: string, meaningKeys: readonly string[] | null): boolean {
  const typed = typedTerms();
  if (typed.length >= MAX_TERMS) return false;

  // The list always holds one empty row to type into. Fill it rather than
  // leaving an empty row above the new word. setTermText replaces a term in
  // place, so the filled row keeps its position - track it by id rather than
  // assuming it lands last, which is wrong whenever the empty row was not the
  // last one (a reader who cleared an earlier box while a later one still
  // held a word).
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
  renderTermRows();
  runSearch();
  return true;
}

/**
 * Is there a colour left for another word?
 *
 * Asked before a click is offered, so the panel can say the palette is full
 * rather than showing a button that would quietly do nothing.
 */
export function canAddTerm(): boolean {
  return typedTerms().length < MAX_TERMS;
}

/**
 * How many verses one term accounts for on its own.
 *
 * Takes the term, not a row number. Results are indexed by a term's position
 * among the terms actually being searched, which is not its position among the
 * rows on screen — a row holding nothing, or one letter, occupies a row but no
 * search slot. Indexing by row instead gives a row its neighbour's count as
 * soon as an earlier row is emptied.
 */
function termHitCount(term: SearchTerm): number {
  const index = activeTerms().indexOf(term);
  if (index === -1) return 0;

  let count = 0;
  for (const result of currentResults) {
    if (result.matchingTerms.some((m) => m.termIndex === index)) count++;
  }
  return count;
}

/**
 * The one number the term rows cannot show: how many verses the search finds
 * altogether. Each row carries its own count; this is their union.
 */
function updateHitCaption(): void {
  if (!searchHitCaption) return;

  const active = activeTerms();
  const listed = resultsForOpenRow().length;

  let message: string;
  if (active.length > 0 && currentResults.length > 0) {
    // The list shows the open row's verses, so the caption above it counts
    // those, and names the union second so the number the rows cannot show
    // between them is still somewhere. With one term the two are the same
    // number and saying it twice would be noise.
    message =
      listed === currentResults.length
        ? `${currentResults.length} matching verses`
        : `${listed} of ${currentResults.length} matching verses`;
  } else if (active.length > 0) {
    message = 'No matching verses';
  } else if (typedTerms().length > 0) {
    message = 'Type at least 2 characters per term';
  } else {
    message = 'Type to search';
  }

  searchHitCaption.textContent = message;
}

/** The rows always have somewhere to type, even before anything is typed. */
function activeOrEmptyTerms(): SearchTerm[] {
  if (terms.length === 0) terms = addTerm([], '');
  return terms;
}

/**
 * Make this row the one the reader is working in.
 *
 * The list and the caption follow the open row, so both are redrawn — without
 * rerunning the search, which has not changed.
 */
function openRow(id: string): void {
  openTermId = id;
  renderTermRows();
  renderResults();
  updateHitCaption();
}

/**
 * What the term rows are allowed to ask of the search.
 *
 * Narrow and one-way on purpose. The rows read and write the term list without
 * holding it, so it keeps one owner; a term list exported for another module to
 * edit is a global with extra steps.
 */
const termRowsHost: TermRowsHost = {
  terms: activeOrEmptyTerms,
  openId: () => openTerm()?.id ?? null,
  hitCount: (term) => (activeTerms().includes(term) ? termHitCount(term) : null),
  setTerms(next) {
    terms = next;
    runSearch();
  },
  openRow,
  addRow() {
    terms = addTerm(terms, '');
    openRow(terms[terms.length - 1].id);
  },
};

/** Redraw the list of verses for the row the reader is working in. */
function renderResults(): void {
  if (!searchResults) return;

  renderResultsList(searchResults, {
    results: resultsForOpenRow(),
    terms: activeTerms(),
    focus: openTermIndex(),
    onSelect: showVerse,
  });
}

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
 * A verse's colour given the searched terms and what they matched: each
 * matching term's own colour, stippled when there are several, or dimmed grey
 * when none match.
 */
function searchColorAt(
  verse: TanakhIdentity,
  active: SearchTerm[],
  matches: Map<string, number[]>,
): Color | Color[] | null {
  if (active.length === 0) return null;

  const termIndices = matches.get(tanakhKey(verse.book, verse.chapter, verse.verse));

  if (termIndices && termIndices.length > 0) {
    // Guard the index: results can outlive the term list they came from for
    // one frame, between a term being removed and the search rerunning.
    const colors = termIndices
      .filter((i) => i < active.length)
      .map((i) => SEARCH_COLORS[colorIndexAt(active, i)]);
    if (colors.length === 0) return null;
    if (colors.length === 1) {
      return colors[0];
    }
    // Stipple effect for multiple matches, capped at 4 colors.
    return colors.slice(0, 4) as Color[];
  }

  const brightness = (0.4 + 0.2) * HIGHLIGHT_CONSTANTS.DIM_FACTOR;
  return [brightness, brightness, brightness];
}

/** The term list a set of settings describes, with its modes and meanings laid over it. */
function termsFromSettings(settings: UrlParamValues<typeof URL_PARAMS>): SearchTerm[] {
  let list = parseSearchTerms(settings.q ?? '').reduce(addTerm, [] as SearchTerm[]);
  if (list.length === 0) list = addTerm([], '');
  if (settings.mode) list = applyModes(list, settings.mode);
  if (settings.m) list = applyMeanings(list, settings.m);
  return list;
}

/** The verse text, with every searched term marked in its own colour. */
export function highlightSearchTerms(text: string, language: TextLanguage): DocumentFragment {
  return highlightTerms(text, language, activeTerms());
}

export const searchOverlay: Overlay = {
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

  getVerseColor(verse: TanakhIdentity): Color | Color[] | null {
    return searchColorAt(verse, activeTerms(), matchingTerms);
  },

  colorsFor(items, settings, _hovered) {
    const active = searchable(termsFromSettings(settings));
    if (active.length === 0) return items.map(() => null);
    const { matchingTerms: matches } = matchesForTerms(active);
    return items.map((item) => searchColorAt(item, active, matches));
  },

  renderControls(container: HTMLElement): void {
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

    renderTermRows();
    updateHitCaption();
    if (currentResults.length > 0) renderResults();
  },

  getHoverInfo(verse: TanakhIdentity): string | null {
    const active = activeTerms();
    if (active.length === 0) return null;

    const termIndices = matchingTerms.get(tanakhKey(verse.book, verse.chapter, verse.verse));
    if (!termIndices) return null;

    // Each term is named the way that term was searched for. A verse can be
    // claimed by a word narrowed to one meaning and by an exact spelling at
    // once, and saying so is the point of the modes being separate.
    const named = termIndices.map((i) => {
      const term = active[i];
      if (!term) return '';

      if (meaningsApply(term)) {
        // Name the meanings, not the spelling: that is what was searched for.
        const chosen = term.meanings.filter((m) => term.selected.has(m.keys[0]));
        if (chosen.length > 0) return chosen.map((m) => m.gloss).join(' / ');
      }
      return effectiveMode(term) === 'word' ? `word "${term.text}"` : `"${term.text}"`;
    });

    return `Matches: ${named.filter(Boolean).join(', ')}`;
  },

  onUpdate(callback: () => void): void {
    updateCallback = callback;
  },

  destroy(): void {
    detachResults(searchResults);
    unmountTermRows();
    searchResults = null;
    searchHitCaption = null;
    updateCallback = null;
    onVerseClickCallback = null;
    // terms, currentResults and matchingTerms are left alone: they should
    // persist across overlay switches so the reader can return to their
    // search, including the mode each term was being matched by.
  },

  urlParams: URL_PARAMS,

  getUrlParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const query = currentQuery();
    if (query) {
      params.q = query;
    }
    if (query) {
      // Both are positional over the same list, so they are written together
      // and a term that has chosen nothing contributes an empty entry rather
      // than being skipped — skipping it would shift every later term.
      const modes = encodeModes(activeTerms());
      if (modes) params.mode = modes;

      const meanings = encodeMeanings(activeTerms());
      if (meanings) params.m = meanings;
    }
    return params;
  },

  applyUrlParams(params: UrlParamValues<typeof URL_PARAMS>): void {
    terms = termsFromSettings(params);

    // A fresh list means a fresh choice of which row is open.
    openTermId = null;
    runSearch();
  },

  highlightVerseText(text: string, language: TextLanguage): DocumentFragment {
    return highlightSearchTerms(text, language);
  },
};
