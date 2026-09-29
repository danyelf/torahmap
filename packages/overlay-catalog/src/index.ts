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
    'Shades each verse by how much has been written about it: the brighter the verse, ' +
    'the more commentary Sefaria records on it. Choose a kind of commentary to count ' +
    'only that one.',
  urlParams: COMMENTARY_PARAMS,
} as const satisfies OverlayEntry;

const TROP_PARAMS = [{ key: 'trop', kind: 'token' }] as const satisfies readonly UrlParamSpec[];

export const TROP = {
  id: 'trop',
  name: 'Trop',
  description:
    'The cantillation marks that say how the Hebrew is chanted, and where in the text ' +
    'they punctuate. Pick a mark to see which verses carry it, and how often.',
  urlParams: TROP_PARAMS,
} as const satisfies OverlayEntry;

/** The customs the haftarah overlay offers; also `Custom`'s only source (see `haftarah/readings.ts`). */
export const HAFTARAH_CUSTOMS = ['ashkenazi', 'sephardi'] as const;

const HAFTARAH_PARAMS = [
  { key: 'custom', kind: 'token', allowed: HAFTARAH_CUSTOMS, default: 'ashkenazi' },
] as const satisfies readonly UrlParamSpec[];

export const HAFTARAH = {
  id: 'haftarah',
  name: 'Haftarah',
  description:
    'The weekly Torah portion read in synagogue and the passage from the Prophets read ' +
    'after it, shown in the same colour so the pairing is visible. Ashkenazi and ' +
    'Sephardi custom differ, and you can switch between them.',
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
