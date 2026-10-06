// Validating a link's parameters: the view's own, and each overlay's against its declaration.

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
  /**
   * The value the overlay holds when the URL says nothing — the other half of
   * the rule overlays already follow when they omit a default on the way out.
   * An overlay that has no such value (a selection that can be empty, say)
   * leaves this unset, and the key stays absent instead.
   */
  readonly default?: string;
}

/**
 * The record an overlay receives: exactly the keys it declared, already
 * validated, and narrowed to the allowed values where it named a set. A key
 * with a default is always present.
 *
 * With no specs to go on this widens to "some strings, or nothing", which is
 * what the `Overlay` interface has to promise before it knows the overlay.
 */
export type UrlParamValues<S extends readonly UrlParamSpec[] = readonly UrlParamSpec[]> = OneRecord<
  {
    readonly [P in S[number] as P extends { default: string } ? P['key'] : never]: ValueOf<P>;
  } & {
    readonly [P in S[number] as P extends { default: string } ? never : P['key']]?: ValueOf<P>;
  }
>;

type OneRecord<T> = { [K in keyof T]: T[K] };

type ValueOf<P extends UrlParamSpec> = P extends { allowed: readonly (infer V extends string)[] }
  ? V
  : string;

/**
 * The search's keys, read whatever overlay is on; no overlay may claim them.
 * Shortcut: they are the Tanakh's search's keys, read on every text.
 */
export const SEARCH_URL_PARAMS = [
  { key: 'search', kind: 'text' },
  // Positional across the terms in `search`, one letter each, and an empty
  // entry for a term still on its default (see MODE_LETTERS in src/tanakh/search/terms.ts).
  { key: 'mode', kind: 'token' },
  { key: 'm', kind: 'names' },
] as const satisfies readonly UrlParamSpec[];

export const SEARCH_KEYS: ReadonlySet<string> = new Set(SEARCH_URL_PARAMS.map((p) => p.key));

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
export function validateString(
  value: string | null,
  maxLength: number = MAX_STRING_LENGTH,
): string | null {
  const trimmed = baseValidate(value, maxLength);
  if (!trimmed) return null;

  if (/[/\\|;]/.test(trimmed)) return null;

  return trimmed;
}

// Allows letters, spaces, and slashes, for categories like "Talmud/Mishnah".
// More permissive than validateString, which rejects the slash outright.
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
 * an overlay — a URL query string, a story stop — comes through here, so an
 * overlay never has to re-check what its own declaration already promised.
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
    const value = validateOneParam(spec, read(spec.key)) ?? spec.default;
    if (value) values[spec.key] = value;
  }
  // The one assertion in the chain, and the place it belongs: the loop above
  // is what makes the claim true, and every caller inherits it from here.
  return values as UrlParamValues<S>;
}

// The range a link may carry and the range the camera allows are one range;
// this package owns it because packages cannot import from src/.
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10.0;
// The zoom the map opens at, which a link leaves out.
export const DEFAULT_ZOOM = 1.0;

const MAX_PAN_POSITION = 1000000;

type TextKey = 'story' | 'stop' | 'overlay' | 'verse';
type NumberKey = 'zoom' | 'x' | 'y';

/** The parts of a view a link names under its own keys. */
export type ViewFields = { [K in TextKey]?: string } & { [K in NumberKey]?: number };

/** How one of the link's own keys is read, or null to drop it, and written, or null to leave it out. */
export interface ViewKey<V> {
  parse(raw: string): V | null;
  format(value: V): string | null;
}

function name(maxLength?: number): ViewKey<string> {
  return { parse: (raw) => validateString(raw, maxLength), format: (value) => value || null };
}

function number(decimals: number, inRange: (n: number) => boolean, left?: number): ViewKey<number> {
  return {
    parse(raw) {
      const n = parseFloat(raw);
      return Number.isFinite(n) && inRange(n) ? n : null;
    },
    format: (n) => (n === left ? null : n.toFixed(decimals).replace(/\.?0+$/, '')),
  };
}

const pan = number(1, (n) => Math.abs(n) <= MAX_PAN_POSITION);

// The link's own keys, text then numbers, in the order a link writes them.
export const TEXT_KEYS: Readonly<Record<TextKey, ViewKey<string>>> = {
  story: name(),
  stop: name(),
  overlay: name(),
  // "Book.Chapter.Verse", e.g. "I.Samuel.1.5"
  verse: name(100),
};

export const NUMBER_KEYS: Readonly<Record<NumberKey, ViewKey<number>>> = {
  zoom: number(2, (n) => n >= MIN_ZOOM && n <= MAX_ZOOM, DEFAULT_ZOOM),
  x: pan,
  y: pan,
};

/** No overlay may claim one of the link's own keys. */
export const RESERVED_KEYS: ReadonlySet<string> = new Set([
  ...Object.keys(TEXT_KEYS),
  ...Object.keys(NUMBER_KEYS),
]);

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}
