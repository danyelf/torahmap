// Reading and writing the view a link names.

import type { ZoomRange } from '@torahmap/engine';
import {
  validateOverlayParams,
  RESERVED_KEYS,
  SQUARE_ID,
  TEXT_KEYS,
  PAN_KEYS,
  VIEW_KEYS,
  zoomKey,
  type ViewKey,
  type OverlayParams,
  type OverlayParamSpecLookup,
  type UrlParamSpec,
  type UrlParamValues,
  type ViewFields,
} from './params.ts';

export interface UrlState extends ViewFields {
  overlayParams: OverlayParams;
  /** The search's own keys, when the link searches. */
  searchParams?: UrlParamValues;
}

/** The keys a text's links use beside the view's own, and the zooms they may carry. */
export interface LinkKeys {
  /** The pinned square's key. */
  square: string;
  /** The search's keys, read whatever overlay is on. */
  search: readonly UrlParamSpec[];
  overlayParams: OverlayParamSpecLookup;
  zoom: ZoomRange;
}

/** The keys no overlay may have: the view's own, the square's and the search's. */
function takenKeys(keys: LinkKeys): ReadonlySet<string> {
  return new Set([...RESERVED_KEYS, keys.square, ...keys.search.map((spec) => spec.key)]);
}

/**
 * Whether a parsed link names any part of the view, as opposed to a query
 * string that carries only tracking parameters (utm_source, fbclid) neither
 * readLink nor writeLink recognizes. overlayParams is not checked: it is only
 * ever populated alongside an overlay, which is checked directly.
 */
export function linkNamesAView(state: UrlState): boolean {
  const named = [...VIEW_KEYS, 'square' as const].some((key) => state[key] !== undefined);
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

/** The view a link's query string names, under a text's keys. Accepts "?a=b", "a=b" or URLSearchParams. */
export function readLink(query: string | URLSearchParams, keys: LinkKeys): UrlState {
  const params = typeof query === 'string' ? new URLSearchParams(query) : query;

  const state: UrlState = { overlayParams: {} };
  readKeys(state, TEXT_KEYS, params);
  readKeys(state, { zoom: zoomKey(keys.zoom), ...PAN_KEYS }, params);
  const square = params.get(keys.square);
  const id = square ? SQUARE_ID.parse(square) : null;
  if (id !== null) state.square = id;

  if (state.overlay) {
    const taken = takenKeys(keys);
    const specs = keys.overlayParams(state.overlay)?.filter((spec) => !taken.has(spec.key));
    state.overlayParams = validateOverlayParams(specs, params);
  }

  const search = validateOverlayParams(keys.search, params);
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
export function writeLink(state: UrlState, keys: LinkKeys): string {
  const params = new URLSearchParams();
  if (linkKind(state) === 'stop') {
    writeKeys(params, state, { story: TEXT_KEYS.story, stop: TEXT_KEYS.stop });
    return `?${params.toString()}`;
  }

  // The search first, then the overlay it sits over.
  for (const [key, value] of Object.entries(state.searchParams ?? {})) {
    if (value) params.set(key, value);
  }

  // A square centres the map, so a link that names one carries no pan.
  const view = state.square ? { ...state, x: undefined, y: undefined } : state;
  writeKeys(params, view, TEXT_KEYS);
  const square = view.square && SQUARE_ID.format(view.square);
  if (square) params.set(keys.square, square);
  writeKeys(params, view, { zoom: zoomKey(keys.zoom), ...PAN_KEYS });

  // Overlay-specific parameters, written through unchanged. Overlays omit
  // their own defaults, so whatever arrives here belongs in the URL.
  const taken = takenKeys(keys);
  for (const [key, value] of Object.entries(state.overlayParams)) {
    if (value && !taken.has(key)) params.set(key, value);
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
