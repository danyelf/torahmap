// What a Cloudflare Worker (or anything else outside the map) can know about an
// overlay without pulling in its drawing code, which imports CSS and touches
// the DOM: its id, name, description and the URL parameters it owns; and the
// search's, which together make a Tanakh link's keys.

import type { LinkKeys, UrlParamSpec, OverlayParamSpecLookup } from '@torahmap/link';

export interface OverlayEntry<S extends readonly UrlParamSpec[] = readonly UrlParamSpec[]> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly urlParams?: S;
}

const COMMENTARY_PARAMS = [
  { key: 'category', kind: 'category', default: 'total' },
] as const satisfies readonly UrlParamSpec[];

export const COMMENTARY = {
  id: 'commentary',
  name: 'Commentary',
  description:
    'Cross-references from later texts. Shades each verse by how many it has: the ' +
    'brighter the verse, the more commentary Sefaria records on it. Choose a kind of ' +
    'commentary to count only that one.',
  urlParams: COMMENTARY_PARAMS,
} as const satisfies OverlayEntry;

const TROP_PARAMS = [{ key: 'trop', kind: 'token' }] as const satisfies readonly UrlParamSpec[];

export const TROP = {
  id: 'trop',
  name: 'Trop',
  description:
    'The frequency of cantillation marks. The brighter the verse, the more often the ' +
    'chosen mark appears in it. Pick a mark to see which verses carry it.',
  urlParams: TROP_PARAMS,
} as const satisfies OverlayEntry;

/** The customs the haftarah overlay offers, in the order it offers them. */
export const HAFTARAH_CUSTOMS = ['ashkenazi', 'sephardi'] as const;

const HAFTARAH_PARAMS = [
  { key: 'custom', kind: 'token', allowed: HAFTARAH_CUSTOMS, default: 'ashkenazi' },
  // A reading's name, e.g. "Lech Lecha" or "Tisha B'Av, Morning".
  { key: 'reading', kind: 'token' },
] as const satisfies readonly UrlParamSpec[];

export const HAFTARAH = {
  id: 'haftarah',
  name: 'Haftarah',
  description:
    'The weekly haftarah readings. Shows each Torah portion and its passage from the ' +
    'Prophets in the same colour. Ashkenazi and Sephardi custom differ, and you can ' +
    'switch between them.',
  urlParams: HAFTARAH_PARAMS,
} as const satisfies OverlayEntry;

export const VERSE_LENGTH = {
  id: 'verse-length',
  name: 'Verse Length',
  description: "Each verse's length in Hebrew words. The brighter the verse, the longer it is.",
} as const satisfies OverlayEntry;

/** Every overlay the menu offers, in the order it offers them. */
export const OVERLAYS = [COMMENTARY, TROP, HAFTARAH, VERSE_LENGTH] as const;

export type OverlayId = (typeof OVERLAYS)[number]['id'];

const BY_ID: ReadonlyMap<string, OverlayEntry> = new Map(OVERLAYS.map((e) => [e.id, e]));

/** The link keys an overlay declares, by id; undefined for an unknown id. */
export const overlayParamSpecs: OverlayParamSpecLookup = (id) => BY_ID.get(id)?.urlParams;

/** The search's keys, read whatever overlay is on; no overlay may claim them. */
export const SEARCH_URL_PARAMS = [
  { key: 'search', kind: 'text' },
  // Positional across the terms in `search`, one letter each, and an empty
  // entry for a term still on its default (see MODE_LETTERS in src/tanakh/search/terms.ts).
  { key: 'mode', kind: 'token' },
  { key: 'm', kind: 'names' },
] as const satisfies readonly UrlParamSpec[];

export const SEARCH_KEYS: ReadonlySet<string> = new Set(SEARCH_URL_PARAMS.map((p) => p.key));

/** The keys of a Tanakh link, which the map and the Worker read alike. */
export const LINK_KEYS: LinkKeys = {
  square: 'verse',
  search: SEARCH_URL_PARAMS,
  overlayParams: overlayParamSpecs,
};

/** An overlay's display name, by id; undefined for an unknown id. */
export const overlayName = (id: string): string | undefined => BY_ID.get(id)?.name;

/** The overlay id that stands for none: the picker's first option, and what telemetry records. */
export const NO_OVERLAY = 'none';
