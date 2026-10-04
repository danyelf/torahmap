// Reading and writing the view a link names.

import {
  validateOverlayParams,
  SEARCH_URL_PARAMS,
  RESERVED_KEYS,
  TEXT_KEYS,
  NUMBER_KEYS,
  type ViewKey,
  type OverlayParams,
  type OverlayParamSpecLookup,
  type UrlParamValues,
  type ViewFields,
} from './params.ts';

export interface UrlState extends ViewFields {
  overlayParams: OverlayParams;
  /** The search's own keys, when the link searches. */
  searchParams?: UrlParamValues;
}

// Allows letters (including Hebrew), spaces, and dots, for names like "I.Samuel".
function validateBookName(book: string): boolean {
  if (!book || book.trim() === '') return false;
  return /^[a-zA-Z\u0590-\u05FF\s.]+$/.test(book);
}

/**
 * Whether a parsed link names any part of the view, as opposed to a query
 * string that carries only tracking parameters (utm_source, fbclid) neither
 * readLink nor writeLink recognizes. overlayParams is not checked: it is only
 * ever populated alongside an overlay, which is checked directly.
 */
export function linkNamesAView(state: UrlState): boolean {
  const named = [...keysOf(TEXT_KEYS), ...keysOf(NUMBER_KEYS)].some(
    (key) => state[key] !== undefined,
  );
  return named || state.searchParams !== undefined;
}

export type LinkKind = 'nothing' | 'view' | 'stop';

/**
 * What kind of link this is: a story stop, a plain view, or nothing named at
 * all. A stop without a story is a stop in the story the page opens by default.
 */
export function linkKind(state: UrlState): LinkKind {
  if (state.story !== undefined || state.stop !== undefined) return 'stop';
  return linkNamesAView(state) ? 'view' : 'nothing';
}

/**
 * The view a link's query string names. Accepts "?a=b", "a=b" or URLSearchParams.
 *
 * Without lookupOverlayParams, overlay parameters are skipped; the core view
 * state still parses.
 */
export function readLink(
  query: string | URLSearchParams,
  lookupOverlayParams?: OverlayParamSpecLookup,
): UrlState {
  const params = typeof query === 'string' ? new URLSearchParams(query) : query;

  const state: UrlState = { overlayParams: {} };
  readKeys(state, TEXT_KEYS, params);
  readKeys(state, NUMBER_KEYS, params);

  if (state.overlay) {
    state.overlayParams = validateOverlayParams(lookupOverlayParams?.(state.overlay), params);
  }

  const search = validateOverlayParams(SEARCH_URL_PARAMS, params);
  if (Object.keys(search).length > 0) state.searchParams = search;
  return state;
}

function keysOf<K extends string>(keys: Readonly<Record<K, unknown>>): K[] {
  return Object.keys(keys) as K[];
}

function readKeys<K extends string, V>(
  state: NoInfer<{ [key in K]?: V }>,
  keys: Readonly<Record<K, ViewKey<V>>>,
  params: URLSearchParams,
): void {
  for (const key of keysOf(keys)) {
    const raw = params.get(key);
    const value = raw ? keys[key].parse(raw) : null;
    if (value !== null) state[key] = value;
  }
}

function writeKeys<K extends string, V>(
  params: URLSearchParams,
  state: NoInfer<{ [key in K]?: V }>,
  keys: Readonly<Record<K, ViewKey<V>>>,
): void {
  for (const key of keysOf(keys)) {
    const value = state[key];
    const text = value === undefined ? null : keys[key].format(value);
    if (text !== null) params.set(key, text);
  }
}

/** The query string for a view, with its leading "?", or "" for the default view. */
export function writeLink(state: UrlState): string {
  const params = new URLSearchParams();
  if (linkKind(state) === 'stop') {
    writeKeys(params, state, { story: TEXT_KEYS.story, stop: TEXT_KEYS.stop });
    return `?${params.toString()}`;
  }

  // The search first, then the overlay it sits over.
  for (const [key, value] of Object.entries(state.searchParams ?? {})) {
    if (value) params.set(key, value);
  }

  // A verse centres the map, so a link that names one carries no pan.
  const view = state.verse ? { ...state, x: undefined, y: undefined } : state;
  writeKeys(params, view, TEXT_KEYS);
  writeKeys(params, view, NUMBER_KEYS);

  // Overlay-specific parameters, written through unchanged. Overlays omit
  // their own defaults, so whatever arrives here belongs in the URL.
  for (const [key, value] of Object.entries(state.overlayParams)) {
    if (!value) continue;
    if (RESERVED_KEYS.has(key)) continue;
    params.set(key, value);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

/** A book's name as a link writes it: "I Samuel" -> "I.Samuel". */
export function bookToUrl(book: string): string {
  return book.replace(/ /g, '.');
}

/** A book's name as a link wrote it: "I.Samuel" -> "I Samuel". */
export function bookFromUrl(urlBook: string): string {
  return urlBook.replace(/\./g, ' ');
}

/** A verse's id, the one name every part of the app uses for it: "I Samuel" 1:5 -> "I.Samuel.1.5". */
export function verseId(book: string, chapter: number, verse: number): string {
  return `${bookToUrl(book)}.${chapter}.${verse}`;
}

/** A verse as readers write it: "I Samuel 1:5". */
export function verseRef(v: { book: string; chapter: number; verse: number }): string {
  return `${v.book} ${v.chapter}:${v.verse}`;
}

/**
 * Read a verse id: "I.Samuel.1.5" -> { book: "I Samuel", chapter: 1, verse: 5 },
 * or null for anything verseId would not write.
 */
export function parseVerseId(
  verseStr: string,
): { book: string; chapter: number; verse: number } | null {
  // Split from the end to handle book names with dots, e.g. "I.Samuel.1.5".
  const parts = verseStr.split('.');
  if (parts.length < 3) return null;
  if (parts.length > 5) return null; // max 3 parts for book name + 2 for chapter/verse

  const verseStr_ = parts.pop()!;
  const chapterStr = parts.pop()!;
  const book = bookFromUrl(parts.join('.'));

  const verse = parseInt(verseStr_, 10);
  const chapter = parseInt(chapterStr, 10);

  if (isNaN(verse) || isNaN(chapter)) return null;
  if (verse < 0 || chapter < 0) return null;

  // No book has >200 chapters, no chapter has >200 verses
  if (chapter > 200 || verse > 200) return null;

  if (!validateBookName(book)) return null;

  // A verse's square is found by its exact id, so "Genesis.01.1" names none.
  return verseId(book, chapter, verse) === verseStr ? { book, chapter, verse } : null;
}
