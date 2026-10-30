// A text's search over its own items: the term list a reader types, what it
// finds, and the panel, colours, marks and link that show it.
//
// The term list is the search's settings, and the app holds it: every member
// here is handed the list and none keeps one. Which row the reader is working
// in is presentation, not a setting, so each search holds its own.
import { colorToCss, isSearchableWord, memoByValue, type Color } from '@torahmap/utils';
import type { SearchTelemetry, SearchTool } from '@torahmap/shell/app/search.ts';
import { PALETTE } from '@torahmap/shell/overlays/palette.ts';
import type {
  Credit,
  FileNames,
  SettingsUpdate,
  UrlParamSpec,
  UrlParamValues,
} from '@torahmap/shell/overlays/types.ts';
import type { TextLanguage } from '@torahmap/shell/language.ts';
import type { ExtraMode } from './extraMode.ts';
import './search.css';
import { highlightTerms } from './highlight.ts';
import type { SearchLanguage } from './language.ts';
import { createResultsList, type ResultsView } from './resultsList.ts';
import { mountTermRows, type TermRows } from './termRows.ts';
import {
  byExtra,
  excerptOf,
  matcherOf,
  modeIn,
  resultsOf,
  type SearchContext,
} from './searching.ts';
import { NO_TELEMETRY } from './telemetry.ts';
import {
  addTerm,
  applyModes,
  colorIndexAt,
  encodeModes,
  heldColors,
  languageOf,
  MAX_TERMS,
  parseSearchTerms,
  setMode,
  setTermText,
  type SearchTerm,
} from './terms.ts';
import { matchingTermsOf, type SearchResult, type Snippet, type TextIndex } from './textIndex.ts';
import type { MatchMode } from './matching.ts';

/**
 * A list of terms, each with its own text, its own colour and its own way of
 * being matched. There is always at least one, possibly empty, so the panel
 * always has somewhere to type.
 *
 * A term's colour is not in the URL: it survives a neighbour being removed, so
 * the list itself is the setting rather than the URL values it is written as.
 */
export interface TermSettings {
  readonly terms: SearchTerm[];
}

export interface TermSearchSpec<D, X> {
  /** A term is in the first of these that claims it, else the last. */
  languages: readonly SearchLanguage[];
  /** The files search reads, as SearchTool's `data`. */
  data: FileNames<D>;
  /** The items, folded for matching. The same files must give the same object. */
  index(data: D): TextIndex;
  /** What a result is called: 'verse', 'verses'. */
  noun: { one: string; many: string };
  /** The whole an item belongs to, by key and name, when counts should say how many wholes match. */
  countedAs?: { noun: { one: string; many: string }; of(id: string): string };
  placeholder: string;
  description: string;
  credits?: readonly Credit[];
  /** Every link key the search reads: TERM_SEARCH_PARAMS, plus the extra mode's. */
  urlParams: readonly UrlParamSpec[];
  extra?: ExtraMode<X, D>;
  /** How a term is matched while the reader has not said and the extra mode does not claim it: substring unless given. */
  defaultMode?: MatchMode;
  /** As SearchTool's `filesNow`. */
  filesNow?(settings: TermSettings): readonly string[];
  /** Whether going from `before` to `after` changes only what result rows quote, so they are quoted again in place. */
  onlyQuotesChange?(before: D, after: D): boolean;
  /** What records the search, built from what it counts. */
  telemetry?(search: SearchCounts<D>): SearchTelemetry<TermSettings, D>;
}

/** What a search says of each of its terms. */
export interface SearchCounts<D> {
  /** How many items (or wholes, when the search counts those) one term accounts for on its own, or null when it is not being searched. */
  hitCount(data: D, settings: TermSettings, term: SearchTerm): number | null;
  /** A term's mode, the extra mode clamped where it cannot apply. */
  modeOf(data: D | null, term: SearchTerm): string;
}

/** What a term list finds: the terms searched, and the items they match. */
interface Search {
  /** The terms the search actually runs, in order (see activeTerms). */
  active: SearchTerm[];
  results: SearchResult[];
  /** Item id to the positions, among the searched terms, of the terms it matches. */
  matchingTerms: Map<string, number[]>;
}

const NO_SEARCH: Search = { active: [], results: [], matchingTerms: new Map() };

/** The terms the search runs: those holding a word, not a single letter. */
export function activeTerms(settings: TermSettings): SearchTerm[] {
  return settings.terms.filter((t) => isSearchableWord(t.text));
}

/** Terms holding something, including ones too short to search on. */
function typedTerms(settings: TermSettings): SearchTerm[] {
  return settings.terms.filter((t) => t.text.trim().length > 0);
}

/**
 * Is there a colour left for another word?
 *
 * Asked before a click is offered, so the panel can say the palette is full
 * rather than showing a button that would quietly do nothing.
 */
export function canAddTerm(settings: TermSettings): boolean {
  return typedTerms(settings).length < MAX_TERMS;
}

/** Terms that search on nothing: one empty box to type in. */
const noTerms = (): SearchTerm[] => addTerm([], '');

/** Whether the search has a term it searches on. */
export function isSearching(settings: TermSettings): boolean {
  return activeTerms(settings).length > 0;
}

/** A search, and the members a text needs beside the tool itself. */
export interface TermSearch<I extends { id: string }, D, X> extends SearchCounts<D> {
  tool: SearchTool<I, TermSettings, D>;
  /** Hand the search its items and what a result click does with one. */
  configure(items: readonly I[], onSelect: (item: I) => void): void;
  /** The items these settings find, as the map colours them. */
  resultsFor(data: D, settings: TermSettings): SearchResult[];
  /** A result row's quotation of its item for `term`, as the panel quotes it. */
  excerptFor(data: D, result: SearchResult, term: SearchTerm): Snippet | null;
  /**
   * The search with `text` added as a term matched as `mode`, with `chosen`
   * for the extra mode, in a colour `taken` is not using, or null when the
   * palette is full. Fills the empty row if there is one, and opens the row it
   * fills.
   */
  addTermOrFill(
    settings: TermSettings,
    text: string,
    mode: string,
    chosen: readonly string[] | null,
    taken: readonly number[],
  ): TermSettings | null;
  /** What the extra mode works from, built from search's files. */
  extraOf(data: D): X | null;
}

export function createTermSearch<I extends { id: string }, D, X = never>(
  spec: TermSearchSpec<D, X>,
): TermSearch<I, D, X> {
  const { languages, extra, countedAs } = spec;
  const noun = countedAs?.noun ?? spec.noun;
  /** The first result of each whole, when the search counts wholes; else every result. */
  const onePerWhole = (results: SearchResult[]): SearchResult[] => {
    if (!countedAs) return results;
    const seen = new Set<string>();
    return results.filter((r) => {
      const whole = countedAs.of(r.id);
      if (seen.has(whole)) return false;
      seen.add(whole);
      return true;
    });
  };
  const countOf = (results: SearchResult[]): number => onePerWhole(results).length;
  const extraOf = (data: D): X | null => extra?.build?.(data) ?? null;
  const contextOf = (x: X | null): SearchContext<X> => ({
    languages,
    extra,
    x,
    defaultMode: spec.defaultMode,
  });
  const contextFor = (data: D | null) => contextOf(data ? extraOf(data) : null);
  const modeOf = (data: D | null, term: SearchTerm) => modeIn(contextFor(data), term);

  let items: readonly I[] = [];
  let onSelect: ((item: I) => void) | null = null;
  /** The row the reader last opened. Read through `openTerm`. */
  let openTermId: string | null = null;

  // Per text index and extra data, then per settings: the same settings with
  // other data are another search. Every function in terms.ts returns a new
  // list, so settings are never edited in place.
  const NO_EXTRA = {};
  const searches = memoByValue((index: TextIndex) =>
    memoByValue((key: object) =>
      memoByValue((settings: TermSettings): Search => {
        const x = key === NO_EXTRA ? null : (key as X);
        const active = activeTerms(settings);
        if (active.length === 0) return { active, results: [], matchingTerms: new Map() };
        const results = resultsOf(index, active, contextOf(x));
        return { active, results, matchingTerms: matchingTermsOf(results) };
      }),
    ),
  );

  /** The search these settings run; with no word typed, the empty one, building nothing. */
  function searchFor(data: D, settings: TermSettings): Search {
    if (typedTerms(settings).length === 0) return NO_SEARCH;
    const x = extraOf(data);
    return searches(spec.index(data))((x ?? NO_EXTRA) as object)(settings);
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
  function openTerm(settings: TermSettings): SearchTerm | undefined {
    return settings.terms.find((t) => t.id === openTermId) ?? settings.terms[0];
  }

  /**
   * Where the open row's term sits among the terms being searched, or -1 when
   * that row has nothing to search on — an empty box, or a single letter.
   *
   * Results name a term by its position in the searched list, which is not its
   * position among the rows on screen.
   */
  function openTermIndex(settings: TermSettings): number {
    const open = openTerm(settings);
    return open ? activeTerms(settings).indexOf(open) : -1;
  }

  /**
   * The items the list shows: the ones the open row's word accounts for.
   *
   * A row with nothing to search on narrows nothing, or clicking "add a word"
   * would empty the list.
   */
  function resultsForOpenRow(data: D, settings: TermSettings): SearchResult[] {
    const { results } = searchFor(data, settings);
    const index = openTermIndex(settings);
    if (index === -1) return results;

    return results.filter((result) => result.matchingTerms.some((m) => m.termIndex === index));
  }

  /**
   * Takes the term, not a row number: results name a term by its position among
   * the terms being searched, and a row holding nothing, or one letter, has no
   * position there.
   */
  function hitCount(data: D, settings: TermSettings, term: SearchTerm): number | null {
    const { active, results } = searchFor(data, settings);
    const index = active.indexOf(term);
    if (index === -1) return null;

    return countOf(results.filter((r) => r.matchingTerms.some((m) => m.termIndex === index)));
  }

  // The controls on screen: their elements, where they send a change, and the
  // settings they show. `shown` is display state, for redrawing the rows when the
  // reader opens one; a change is always worked out from the settings the app
  // holds when it applies it, never from `shown`.
  type SettingsChange = (update: SettingsUpdate<TermSettings>) => void;
  let searchResults: HTMLDivElement | null = null;
  let searchHitCaption: HTMLDivElement | null = null;
  let searchClear: HTMLButtonElement | null = null;
  let requestChange: SettingsChange | null = null;
  let shown: TermSettings | null = null;
  let shownData: D | null = null;
  let rows: TermRows | null = null;
  const resultsList = createResultsList();

  /**
   * The one number the term rows cannot show: how many items the search finds
   * altogether. Each row carries its own count; this is their union.
   */
  function updateHitCaption(settings: TermSettings, data: D | null): void {
    if (!searchHitCaption) return;
    if (!data) {
      searchHitCaption.textContent = '';
      return;
    }
    const { active, results } = searchFor(data, settings);
    const listed = countOf(resultsForOpenRow(data, settings));
    const total = countOf(results);

    let message: string;
    if (active.length > 0 && results.length > 0) {
      // The list shows the open row's items, so the caption above it counts
      // those, and names the union second so the number the rows cannot show
      // between them is still somewhere. With one term the two are the same
      // number and saying it twice would be noise.
      message =
        listed === total
          ? `${total} matching ${noun.many}`
          : `${listed} of ${total} matching ${noun.many}`;
    } else if (active.length > 0) {
      message = `No matching ${noun.many}`;
    } else if (typedTerms(settings).length > 0) {
      message = 'Type at least 2 characters per term';
    } else {
      message = 'Type to search';
    }

    searchHitCaption.textContent = message;
  }

  const rtl = (term: SearchTerm) => languageOf(languages, term).rtl;

  /** Redraw the list of items for the row the reader is working in. */
  function renderResults(settings: TermSettings, data: D | null): void {
    if (!searchResults) return;

    if (!data) {
      resultsList.render(searchResults, {
        results: [],
        terms: [],
        focus: -1,
        onSelect: showItem,
        snippet: () => null,
        rtl,
      });
      return;
    }

    resultsList.render(searchResults, {
      results: onePerWhole(resultsForOpenRow(data, settings)),
      terms: searchFor(data, settings).active,
      focus: openTermIndex(settings),
      onSelect: showItem,
      snippet: snippetFor(data),
      rtl,
    });
  }

  function snippetFor(data: D): ResultsView['snippet'] {
    return (result, term) => excerptOf(spec.index(data), result, term, contextFor(data));
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
    rows?.render();
    renderResults(shown, shownData);
    updateHitCaption(shown, shownData);
  }

  /** Hand a clicked result back to the app as the item it names. */
  function showItem(result: SearchResult): void {
    const item = items.find((i) => i.id === result.id);
    if (item && onSelect) onSelect(item);
  }

  /**
   * An item's colour given what a term list found: each matching term's own
   * colour, split corner to corner when there are several.
   */
  function searchColorAt(item: { id: string }, search: Search): Color | Color[] | null {
    const termIndices = search.matchingTerms.get(item.id);
    if (!termIndices || termIndices.length === 0) return null;

    const colors = termIndices.map((i) => PALETTE[colorIndexAt(search.active, i)]);
    return colors.length === 1 ? colors[0] : colors;
  }

  /** The term list a link describes, with its modes and the extra mode's choices laid over it. */
  function settingsFromUrl(params: UrlParamValues): TermSettings {
    let terms = parseSearchTerms(params.search ?? '').reduce(
      (list, text) => addTerm(list, text),
      [] as SearchTerm[],
    );
    if (terms.length === 0) terms = noTerms();
    if (params.mode) terms = applyModes(terms, params.mode, extra);
    const chosen = extra?.param && params[extra.param.key];
    if (extra?.param && chosen) terms = extra.param.read(terms, chosen);
    return { terms };
  }

  const tool: SearchTool<I, TermSettings, D> = {
    id: 'search',
    name: 'Search',
    description: spec.description,
    ...(spec.credits ? { credits: spec.credits } : {}),

    data: spec.data,

    isSearching,
    ...(spec.filesNow ? { filesNow: spec.filesNow } : {}),
    telemetry: spec.telemetry?.({ hitCount, modeOf }) ?? NO_TELEMETRY,

    prebuild(data) {
      spec.index(data);
      extraOf(data);
    },

    colorsFor(list, settings, _hovered, data) {
      const search = searchFor(data, settings);
      return list.map((item) => searchColorAt(item, search));
    },

    urlParams: spec.urlParams,

    settingsFromUrl,

    colorsInUse: (settings) => heldColors(settings.terms),

    summary(settings) {
      return {
        terms: activeTerms(settings).map((t) => ({
          text: t.text.trim(),
          color: colorToCss(PALETTE[t.colorIndex]),
        })),
      };
    },

    settingsToUrl(settings) {
      const active = activeTerms(settings);
      const params: Record<string, string> = {};
      const query = active.map((t) => t.text).join(', ');
      if (query) {
        params.search = query;
        const modes = encodeModes(active, extra);
        if (modes) params.mode = modes;

        const chosen = extra?.param?.write(active);
        if (extra?.param && chosen) params[extra.param.key] = chosen;
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
        searchClear?.addEventListener('click', () => requestChange?.(() => ({ terms: noTerms() })));

        rows?.unmount();
        // Nothing is built while no word is typed.
        const rowsExtra = () =>
          shown && shownData && typedTerms(shown).length > 0 ? extraOf(shownData) : null;
        rows = mountTermRows(
          {
            container: container.querySelector('#search-terms'),
            addTermButton: container.querySelector('#add-term'),
          },
          {
            terms: () => shown?.terms ?? [],
            openId: () => (shown ? (openTerm(shown)?.id ?? null) : null),
            extraData: rowsExtra,
            modeOf: (term) => modeIn(contextOf(rowsExtra()), term),
            hitCount: (term) => (shown && shownData ? hitCount(shownData, shown, term) : null),
            edit(change) {
              requestChange?.((current, taken) => ({ terms: change(current.terms, taken) }));
            },
            openRow,
            addRow() {
              requestChange?.((current, taken) => {
                const terms = addTerm(current.terms, '', taken);
                openTermId = terms[terms.length - 1].id;
                return { terms };
              });
            },
          },
          { languages, extra, placeholder: spec.placeholder },
        );
      } else if (settings === previous && data === previousData) {
        // Nothing has changed, and redrawing the list would scroll it to the top.
        return;
      } else if (
        settings === previous &&
        data &&
        previousData &&
        spec.onlyQuotesChange?.(previousData, data)
      ) {
        // Quote the list again in place, so the reader keeps their place in it.
        resultsList.requote(searchResults, snippetFor(data));
        return;
      }

      rows?.render();
      updateHitCaption(settings, data);
      renderResults(settings, data);
      if (searchClear) searchClear.disabled = typedTerms(settings).length === 0;
    },

    getHoverInfo(item, settings, data) {
      const { active, matchingTerms } = searchFor(data, settings);
      if (active.length === 0) return null;

      const termIndices = matchingTerms.get(item.id);
      if (!termIndices) return null;

      const context = contextFor(data);
      const named = termIndices.map((i) => {
        const term = active[i];
        if (!byExtra(context, term) || !context.extra.hoverNote) return term.text;
        return context.extra.hoverNote(context.x, term, item.id);
      });

      return `Matches: ${named.join(', ')}`;
    },

    destroy(): void {
      resultsList.detach(searchResults);
      rows?.unmount();
      rows = null;
      searchResults = null;
      searchHitCaption = null;
      searchClear = null;
      shown = null;
      shownData = null;
      requestChange = null;
    },

    highlightItemText(item, text, language: TextLanguage, settings, data, within) {
      const textLanguage = languages.find((l) => l.id === language) ?? languages[0];
      return highlightTerms(
        text,
        textLanguage,
        searchFor(data, settings).active,
        matcherOf(contextFor(data), item.id),
        within,
      );
    },
  };

  return {
    tool,
    configure(list, select) {
      items = list;
      onSelect = select;
    },
    hitCount,
    modeOf,
    extraOf,
    resultsFor: (data, settings) => searchFor(data, settings).results,
    excerptFor: (data, result, term) => snippetFor(data)(result, term),
    addTermOrFill(settings, text, mode, chosen, taken) {
      if (!canAddTerm(settings)) return null;

      // Fill the empty row, wherever it is, rather than leave it above the new
      // word; it keeps its place in the list.
      let terms = settings.terms;
      const empty = terms.find((term) => term.text.trim() === '');
      let id: string;
      if (empty) {
        id = empty.id;
        terms = setTermText(terms, id, text, taken);
      } else {
        terms = addTerm(terms, text, taken);
        id = terms[terms.length - 1].id;
      }

      terms = setMode(terms, id, mode);
      if (chosen) terms = terms.map((t) => (t.id === id ? { ...t, chosen: [...chosen] } : t));

      // The word just added is the one the reader is looking at.
      openTermId = id;
      return { terms };
    },
  };
}
