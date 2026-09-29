// Validating an overlay's URL parameters against its own declaration.

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

/** The search's keys, read whatever overlay is on; no overlay may claim them. */
export const SEARCH_URL_PARAMS = [
  { key: 'search', kind: 'text' },
  // Positional across the terms in `search`, one letter each, and an empty
  // entry for a term still on its default (see MODE_LETTERS in search/terms.ts).
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

// The link's own keys, read in link.ts; an overlay may not claim one of these.
export const RESERVED_KEYS: ReadonlySet<string> = new Set([
  'story',
  'stop',
  'overlay',
  'verse',
  'zoom',
  'x',
  'y',
]);

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

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}
