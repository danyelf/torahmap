// Reading and writing the view a link names.

import {
  validateString,
  validateOverlayParams,
  SEARCH_URL_PARAMS,
  RESERVED_KEYS,
  type OverlayParams,
  type OverlayParamSpecLookup,
  type UrlParamValues,
} from './params.ts';

// The range a link may carry and the range the camera allows are one range;
// this module owns it because packages cannot import from src/.
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10.0;

const MAX_PAN_POSITION = 1000000;

export interface UrlState {
  story?: string;
  stop?: string;
  overlay?: string;
  /** "Book.Chapter.Verse", e.g. "Genesis.1.1" */
  verse?: string;
  zoom?: number;
  /** Pan position; unused if verse is set, since a verse auto-centers */
  x?: number;
  y?: number;
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
  return (
    state.story !== undefined ||
    state.stop !== undefined ||
    state.overlay !== undefined ||
    state.verse !== undefined ||
    state.zoom !== undefined ||
    state.x !== undefined ||
    state.y !== undefined ||
    state.searchParams !== undefined
  );
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

  const state: UrlState = {
    overlayParams: {},
  };

  const story = params.get('story');
  const validatedStory = validateString(story);
  if (validatedStory) state.story = validatedStory;

  const stop = validateString(params.get('stop'));
  if (stop) state.stop = stop;

  const overlay = params.get('overlay');
  const validatedOverlay = validateString(overlay);
  // Any validated ID is accepted; the overlay registry handles unknown ones gracefully.
  if (validatedOverlay) {
    state.overlay = validatedOverlay;
  }

  const verse = params.get('verse');
  const validatedVerse = validateString(verse, 100); // Allow longer for book names
  if (validatedVerse) state.verse = validatedVerse;

  const zoom = params.get('zoom');
  if (zoom) {
    const parsed = parseFloat(zoom);
    if (!isNaN(parsed) && parsed >= MIN_ZOOM && parsed <= MAX_ZOOM) {
      state.zoom = parsed;
    }
  }

  const x = params.get('x');
  if (x) {
    const parsed = parseFloat(x);
    if (!isNaN(parsed) && isFinite(parsed) && Math.abs(parsed) <= MAX_PAN_POSITION) {
      state.x = parsed;
    }
  }

  const y = params.get('y');
  if (y) {
    const parsed = parseFloat(y);
    if (!isNaN(parsed) && isFinite(parsed) && Math.abs(parsed) <= MAX_PAN_POSITION) {
      state.y = parsed;
    }
  }

  if (state.overlay) {
    state.overlayParams = validateOverlayParams(lookupOverlayParams?.(state.overlay), params);
  }

  const search = validateOverlayParams(SEARCH_URL_PARAMS, params);
  if (Object.keys(search).length > 0) state.searchParams = search;
  return state;
}

/** The query string for a view, with its leading "?", or "" for the default view. */
export function writeLink(state: UrlState): string {
  if (state.story) {
    const params = new URLSearchParams({ story: state.story });
    if (state.stop) params.set('stop', state.stop);
    return `?${params.toString()}`;
  }

  const params = new URLSearchParams();
  // The search first, then the overlay it sits over.
  for (const [key, value] of Object.entries(state.searchParams ?? {})) {
    if (value) params.set(key, value);
  }

  if (state.overlay) {
    params.set('overlay', state.overlay);
  }

  if (state.verse) {
    params.set('verse', state.verse);
  }

  if (state.zoom !== undefined && state.zoom !== 1.0) {
    // Round to 2 decimal places
    params.set('zoom', state.zoom.toFixed(2).replace(/\.?0+$/, ''));
  }

  // Only include pan if no verse (verse auto-centers)
  if (!state.verse) {
    if (state.x !== undefined) {
      params.set('x', state.x.toFixed(1).replace(/\.?0+$/, ''));
    }
    if (state.y !== undefined) {
      params.set('y', state.y.toFixed(1).replace(/\.?0+$/, ''));
    }
  }

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

/**
 * Convert verse reference to URL format
 * "I Samuel" 1:5 -> "I.Samuel.1.5"
 */
export function verseToUrlFormat(book: string, chapter: number, verse: number): string {
  const urlBook = book.replace(/ /g, '.');
  return `${urlBook}.${chapter}.${verse}`;
}

/** A verse as readers write it: "I Samuel 1:5". */
export function verseRef(v: { book: string; chapter: number; verse: number }): string {
  return `${v.book} ${v.chapter}:${v.verse}`;
}

/**
 * Parse verse reference from URL format
 * "I.Samuel.1.5" -> { book: "I Samuel", chapter: 1, verse: 5 }
 */
export function parseVerseFromUrl(
  verseStr: string,
): { book: string; chapter: number; verse: number } | null {
  // Split from the end to handle book names with dots, e.g. "I.Samuel.1.5".
  const parts = verseStr.split('.');
  if (parts.length < 3) return null;
  if (parts.length > 5) return null; // max 3 parts for book name + 2 for chapter/verse

  const verseStr_ = parts.pop()!;
  const chapterStr = parts.pop()!;
  const book = parts.join(' ');

  const verse = parseInt(verseStr_, 10);
  const chapter = parseInt(chapterStr, 10);

  if (isNaN(verse) || isNaN(chapter)) return null;
  if (verse < 0 || chapter < 0) return null;

  // No book has >200 chapters, no chapter has >200 verses
  if (chapter > 200 || verse > 200) return null;

  if (!validateBookName(book)) return null;

  return { book, chapter, verse };
}
