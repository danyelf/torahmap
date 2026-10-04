// What a Cloudflare Worker (or anything else outside the map) can know about an
// overlay without pulling in its drawing code, which imports CSS and touches
// the DOM: its id, name, description and the URL parameters it owns.

import type { UrlParamSpec, OverlayParamSpecLookup } from '@torahmap/link';

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
    'Cross-references from later texts. Shades each verse by how many references there ' +
    'are in other texts: the brighter the verse, the more commentary Sefaria records on ' +
    'it. Choose a kind of commentary to count only that one.',
  urlParams: COMMENTARY_PARAMS,
} as const satisfies OverlayEntry;

const TROP_PARAMS = [{ key: 'trop', kind: 'token' }] as const satisfies readonly UrlParamSpec[];

export const TROP = {
  id: 'trop',
  name: 'Trop',
  description:
    'The frequency of cantillation marks. Brighter marks appear more often in the text. ' +
    'Pick a mark to see which verses carry it, and how often.',
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
    'The weekly haftarah readings. Shows the weekly Torah portion and the corresponding ' +
    'passage from the Prophets in the same color. Ashkenazi and Sephardi custom differ, ' +
    'and you can switch between them.',
  urlParams: HAFTARAH_PARAMS,
} as const satisfies OverlayEntry;

export const VERSE_LENGTH = {
  id: 'verse-length',
  name: 'Verse Length',
  description:
    'Shades each verse by how many Hebrew words it has, the shortest dark and the ' +
    'longest bright.',
} as const satisfies OverlayEntry;

/** Every overlay the menu offers, in the order it offers them. */
export const OVERLAYS = [COMMENTARY, TROP, HAFTARAH, VERSE_LENGTH] as const;

export type OverlayId = (typeof OVERLAYS)[number]['id'];

const BY_ID: ReadonlyMap<string, OverlayEntry> = new Map(OVERLAYS.map((e) => [e.id, e]));

/** The link keys an overlay declares, by id; undefined for an unknown id. */
export const overlayParamSpecs: OverlayParamSpecLookup = (id) => BY_ID.get(id)?.urlParams;

/** An overlay's display name, by id; undefined for an unknown id. */
export const overlayName = (id: string): string | undefined => BY_ID.get(id)?.name;

/** The overlay id that stands for none: the picker's first option, and what telemetry records. */
export const NO_OVERLAY = 'none';
