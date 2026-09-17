// Parsing and serializing view state to/from the URL hash

import { MIN_ZOOM, MAX_ZOOM } from './camera.ts';

/**
 * The kinds of value an overlay parameter can hold. The overlay picks a kind;
 * this module decides what that kind allows.
 *
 * - `token`    short identifier, e.g. a slugified name or a mode word
 * - `category` a name that may contain spaces and slashes, e.g. "Talmud/Mishnah"
 * - `text`     free-form user text, e.g. a search query
 * - `names`    machine-readable names the app looks up, never shown to a reader
 *
 * The difference between `text` and `names` is what the value is for, and it
 * decides whether HTML tags are stripped out of it. A search query is shown
 * back to the reader, so it is stripped. A list of names is split apart and
 * looked up in a table, and anything unrecognised is dropped long before it
 * could reach the page — so stripping buys nothing, and it does real harm:
 * ETCBC spells ayin `<` and aleph `>`, so two lexeme names side by side read
 * as a tag and everything between them would be deleted.
 */
export type UrlParamKind = 'token' | 'category' | 'text' | 'names';

/**
 * An overlay's declaration of one URL parameter it owns.
 *
 * Declare the list with `as const satisfies readonly UrlParamSpec[]` so that
 * the key names and the allowed values survive as literal types; that is what
 * lets `UrlParamValues` hand the overlay a record it can trust.
 */
export interface UrlParamSpec {
  readonly key: string;
  readonly kind: UrlParamKind;
  /** When present, the value must be one of these after validation. */
  readonly allowed?: readonly string[];
}

/**
 * The record an overlay receives: exactly the keys it declared, already
 * validated, and narrowed to the allowed values where it named a set.
 *
 * With no specs to go on this widens to "some strings, or nothing", which is
 * what the `Overlay` interface has to promise before it knows the overlay.
 */
export type UrlParamValues<S extends readonly UrlParamSpec[] = readonly UrlParamSpec[]> = {
  readonly [P in S[number] as P['key']]?: P extends {
    allowed: readonly (infer V extends string)[];
  }
    ? V
    : string;
};

/**
 * Overlay-specific settings held alongside the view state.
 *
 * This module knows nothing about which keys any particular overlay uses;
 * each overlay declares its own (see `UrlParamSpec`), and this module only
 * decides whether a given value is safe and in range.
 */
export type OverlayParams = UrlParamValues;

/**
 * Looks up the parameter declarations for an overlay by its id.
 * Supplied by the caller so that this module never imports overlays.
 */
export type OverlayParamSpecLookup = (overlayId: string) => readonly UrlParamSpec[] | undefined;

// Keys this module owns; an overlay may not claim one of these.
const RESERVED_KEYS = new Set(['story', 'overlay', 'verse', 'zoom', 'x', 'y']);

const MAX_PAN_POSITION = 1000000;
const MAX_STRING_LENGTH = 50;
const MAX_SEARCH_QUERY_LENGTH = 1000;

/**
 * What a `names` value may contain: the characters lexeme names are written
 * from, the `@` and language that follow one, and the `|` and `,` that
 * separate them. ETCBC uses ASCII for Hebrew consonants, hence the brackets
 * and slashes — `<LH/@heb` is burnt-offering.
 *
 * A value holding anything else did not come from this app and is refused
 * whole, rather than edited into something that would half-apply.
 */
const NAMES_ALLOWED = /^[A-Za-z0-9<>=/@[\]_|,.~-]+$/;

/** Trims, length-checks, and rejects HTML tags, javascript: URLs, and event-handler attributes. */
function baseValidate(value: string | null, maxLength: number): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.length > maxLength) return null;

  if (/<[^>]*>/.test(trimmed)) return null;
  if (/javascript:/i.test(trimmed)) return null;
  if (/on\w+=/i.test(trimmed)) return null;

  return trimmed;
}

/** Like baseValidate, and also rejects slashes, backslashes, pipes, and semicolons. */
function validateString(
  value: string | null,
  maxLength: number = MAX_STRING_LENGTH,
): string | null {
  const trimmed = baseValidate(value, maxLength);
  if (!trimmed) return null;

  if (/[/\\|;]/.test(trimmed)) return null;

  return trimmed;
}

// Allows letters, spaces, and slashes, for categories like "Talmud/Mishnah".
// More permissive than validateString to support legacy categories.
function validateCategoryName(value: string | null): string | null {
  const trimmed = baseValidate(value, MAX_STRING_LENGTH);
  if (!trimmed) return null;

  if (!/^[a-zA-Z\s/]+$/.test(trimmed)) return null;

  return trimmed;
}

/** Validate one overlay parameter against its declared kind, or null to drop it. */
function validateOneParam(spec: UrlParamSpec, raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;

  let cleaned: string | null;
  switch (spec.kind) {
    case 'category':
      cleaned = validateCategoryName(raw);
      break;
    case 'text': {
      // Free text keeps punctuation and non-Latin scripts, but is length
      // capped and has any HTML tags removed.
      const trimmed = raw.trim();
      cleaned =
        trimmed && trimmed.length <= MAX_SEARCH_QUERY_LENGTH ? stripHtmlTags(trimmed) : null;
      break;
    }
    case 'names': {
      // Deliberately not stripped — see UrlParamKind.
      const trimmed = raw.trim();
      cleaned =
        trimmed.length > 0 &&
        trimmed.length <= MAX_SEARCH_QUERY_LENGTH &&
        NAMES_ALLOWED.test(trimmed)
          ? trimmed
          : null;
      break;
    }
    case 'token':
    default:
      cleaned = validateString(raw);
      break;
  }

  if (!cleaned) return null;
  if (spec.allowed && !spec.allowed.includes(cleaned)) return null;
  return cleaned;
}

/**
 * Turn raw key/value pairs into the record an overlay can trust: only the keys
 * it declared, each one validated, each one narrowed to the values it allows.
 *
 * This is the single door into an overlay's settings. Everything that reaches
 * an overlay — a URL hash, a story stop — comes through here, so an overlay
 * never has to re-check what its own declaration already promised.
 */
export function validateOverlayParams<S extends readonly UrlParamSpec[]>(
  specs: S | undefined,
  raw: URLSearchParams | Readonly<Record<string, string | undefined>>,
): UrlParamValues<S> {
  const read = (key: string): string | null | undefined =>
    raw instanceof URLSearchParams ? raw.get(key) : raw[key];

  const values: Record<string, string> = {};
  for (const spec of specs ?? []) {
    if (RESERVED_KEYS.has(spec.key)) continue;
    const value = validateOneParam(spec, read(spec.key));
    if (value) values[spec.key] = value;
  }
  // The one assertion in the chain, and the place it belongs: the loop above
  // is what makes the claim true, and every caller inherits it from here.
  return values as UrlParamValues<S>;
}

// Allows letters (including Hebrew), spaces, and dots, for names like "I.Samuel".
function validateBookName(book: string): boolean {
  if (!book || book.trim() === '') return false;
  return /^[a-zA-Z\u0590-\u05FF\s.]+$/.test(book);
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}

export interface UrlState {
  story?: string;
  overlay?: string;
  /** "Book.Chapter.Verse", e.g. "Genesis.1.1" */
  verse?: string;
  zoom?: number;
  /** Pan position; unused if verse is set, since a verse auto-centers */
  x?: number;
  y?: number;
  overlayParams: OverlayParams;
}

/**
 * Parse the current URL hash into a UrlState object. Without
 * lookupOverlayParams, overlay parameters are skipped; the core view state
 * still parses.
 */
export function parseUrlState(lookupOverlayParams?: OverlayParamSpecLookup): UrlState {
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);

  const state: UrlState = {
    overlayParams: {},
  };

  const story = params.get('story');
  const validatedStory = validateString(story);
  if (validatedStory) state.story = validatedStory;

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

  return state;
}

/** Build a URL hash string from state, omitting default values to keep URLs clean. */
export function buildUrlHash(state: UrlState): string {
  if (state.story) {
    return `#story=${encodeURIComponent(state.story)}`;
  }

  const params = new URLSearchParams();

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

  const hash = params.toString();
  return hash ? `#${hash}` : '';
}

// How many nested applyingExternalState() calls are in progress.
let urlWritesSuspended = 0;

/**
 * Run something that puts state *into* the app from outside — a link being
 * restored, a story stop being applied — with URL writes turned off.
 *
 * This is the one place the rule lives. Anything an overlay does in response,
 * including calling its own update handler, cannot reach the URL from in here,
 * so no overlay has to be careful about it and a new overlay gets the same
 * treatment without anyone remembering to give it.
 */
export function applyingExternalState<T>(apply: () => T): T {
  urlWritesSuspended++;
  try {
    return apply();
  } finally {
    urlWritesSuspended--;
  }
}

/** Whether URL writes are currently suspended. For tests and assertions. */
export function isApplyingExternalState(): boolean {
  return urlWritesSuspended > 0;
}

/**
 * Update the URL with new state. Does nothing while external state is being
 * applied — see applyingExternalState().
 *
 * pushHistory creates a new history entry, for a significant change like
 * overlay or verse; otherwise it replaces the current entry, for pan/zoom.
 */
export function updateUrl(state: UrlState, pushHistory: boolean = false): void {
  if (urlWritesSuspended > 0) return;

  const hash = buildUrlHash(state);
  const newUrl = window.location.pathname + window.location.search + hash;

  if (pushHistory) {
    history.pushState(null, '', newUrl);
  } else {
    history.replaceState(null, '', newUrl);
  }
}

/**
 * Subscribe to browser back/forward navigation.
 *
 * This app writes the URL only through history.pushState/replaceState (see
 * updateUrl above), never by assigning location.hash directly. Those calls
 * fire neither event on their own, so the only thing this needs to catch is
 * history traversal — which fires popstate every time, whether or not the
 * hash differs between entries. hashchange would fire for that too (when the
 * hash does differ, which pushHistory navigations arrange for), so adding it
 * only doubles up the same restore; it would only earn its place if something
 * changed location.hash directly, which nothing here does.
 */
export function subscribeToHashChange(callback: () => void): void {
  window.addEventListener('popstate', callback);
}

/**
 * Convert verse reference to URL format
 * "I Samuel" 1:5 -> "I.Samuel.1.5"
 */
export function verseToUrlFormat(book: string, chapter: number, verse: number): string {
  const urlBook = book.replace(/ /g, '.');
  return `${urlBook}.${chapter}.${verse}`;
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
