// Which passages name the picked rabbis, how to find a rabbi by any of his names, and the colour
// each pick gets. No page in here.

import { maxChroma, memoByValueAndKey, oklchToRgb, rgbToOklch, type Color } from '@torahmap/utils';
import type { TalmudDating } from '../dating.ts';
import type { Rabbi, TalmudRabbis } from '../rabbis.ts';
import { ERAS, eraOf, generationColor, TRANSITION } from './dating.ts';

export interface RabbiData {
  dating: TalmudDating;
  rabbis: TalmudRabbis;
}

export interface RabbiSettings {
  /** Sefaria slugs, in the order picked. */
  picked: string[];
}

/** One more than a passage can show colours for would only repeat a colour. */
export const MAX_PICKS = 6;
/** What the renderer can split one square into. */
export const MAX_COLORS = 4;
const QUICK_PICKS = 28;
const SUGGESTIONS = 6;

/** Whether a passage names a rabbi without doubt, or only as one of the people a name can mean. */
export type Certainty = 'sure' | 'maybe';

/** A choice the finder offers: one rabbi, or a name that can mean several people. */
export interface Entry {
  /** The rabbi's place when the name is certain, else every rabbi it can mean. */
  rabbis: number[];
  en: string;
  he: string;
  /** A generation's code: the rabbi's, or the latest of those the name can mean. */
  gen: string;
  named: number;
  /** Whether choosing it is choosing one rabbi. */
  single: boolean;
}

interface Index {
  placeOf: Map<string, number>;
  /** By rabbi: passages naming him for certain, and those only where a name might be him. */
  sure: number[];
  maybe: number[];
  /** By how often named, most first. */
  entries: Entry[];
}

const build = (rabbis: TalmudRabbis, dating: TalmudDating): Index => {
  const sure = rabbis.rabbis.map(() => 0);
  const maybe = rabbis.rabbis.map(() => 0);
  const naming = new Map<string, { entry: Omit<Entry, 'named'>; ids: Set<string> }>();
  for (const [id, segment] of Object.entries(dating.segments)) {
    const here = new Map<number, Certainty>();
    for (const person of segment[2]) {
      const [certain, ...who] = rabbis.readings[person];
      if (!who.length) continue;
      for (const r of who) if (certain || !here.has(r)) here.set(r, certain ? 'sure' : 'maybe');
      const one = certain === 1 && who.length === 1;
      const key = one ? `r${who[0]}` : `p${person}`;
      if (!naming.has(key)) {
        const { en, he } = one ? rabbis.rabbis[who[0]] : dating.people[person];
        const gen = one
          ? rabbis.rabbis[who[0]].gen
          : dating.generations[dating.people[person].gen].code;
        naming.set(key, { entry: { rabbis: who, en, he, gen, single: one }, ids: new Set() });
      }
      naming.get(key)!.ids.add(id);
    }
    for (const [r, how] of here) (how === 'sure' ? sure : maybe)[r]++;
  }
  return {
    placeOf: new Map(rabbis.rabbis.map((r, i) => [r.id, i])),
    sure,
    maybe,
    entries: [...naming.values()]
      .map(({ entry, ids }) => ({ ...entry, named: ids.size }))
      .sort((a, b) => b.named - a.named),
  };
};

const indexOf = memoByValueAndKey(build);
export const indexFor = ({ rabbis, dating }: RabbiData): Index => indexOf(rabbis, dating);

/** The picked rabbis' places, in the order picked; slugs the data does not hold are dropped. */
export function pickedPlaces(settings: RabbiSettings, data: RabbiData): number[] {
  const { placeOf } = indexFor(data);
  return settings.picked.flatMap((id) => placeOf.get(id) ?? []);
}

/** How each of `places` stands in a passage, for those it names. */
export function namedIn(
  data: RabbiData,
  id: string,
  places: readonly number[],
): Map<number, Certainty> {
  const found = new Map<number, Certainty>();
  const segment = data.dating.segments[id];
  if (!segment) return found;
  for (const person of segment[2]) {
    const [certain, ...who] = data.rabbis.readings[person];
    for (const r of who) {
      if (places.includes(r) && (certain || !found.has(r)))
        found.set(r, certain ? 'sure' : 'maybe');
    }
  }
  return found;
}

/** The passages a rabbi is named in, for certain and else. */
export const passagesOf = (data: RabbiData, place: number) => {
  const { sure, maybe } = indexFor(data);
  return { sure: sure[place], maybe: maybe[place] };
};

/** The generations in order, from the table Dating's colours come from. */
const GENERATION_ORDER = ERAS.flatMap((era) =>
  era.bands.flatMap((band) => band.codes as readonly string[]),
);

const TRANSITION_NAME = 'Tanna/Amora transition';

/** The headings of a key: each era, with the transition generation between the Tannaim and Amoraim. */
const GROUPS = ERAS.flatMap(({ name }) => (name === 'Tannaim' ? [name, TRANSITION_NAME] : [name]));

/**
 * The most-named choices, in groups by era and within each by generation, a group only if it has
 * a choice. A name that can mean several people is one choice, and asks which.
 */
export function quickPicks(data: RabbiData): { heading: string; entries: Entry[] }[] {
  const chosen = indexFor(data).entries.slice(0, QUICK_PICKS);
  const groupOf = (entry: Entry) => (entry.gen === TRANSITION ? TRANSITION_NAME : eraOf(entry.gen));
  const rank = (entry: Entry) => GENERATION_ORDER.indexOf(entry.gen);
  return GROUPS.map((heading) => ({
    heading,
    entries: chosen
      .filter((entry) => groupOf(entry) === heading)
      .sort((a, b) => rank(a) - rank(b) || b.named - a.named),
  })).filter(({ entries }) => entries.length > 0);
}

/** Lower case, without vowel points, accents or punctuation. */
export const plain = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-֑ͯ-ׇ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** A name without the title in front: "rabban gamliel" is found under G. */
const untitled = (name: string): string =>
  name.replace(/^(?:(?:rabban|rabbi|rebbi|rav|rabi|r|רבן|רבי|רב|ר) )+/u, '');

/**
 * Rabbis any of whose names holds every word typed, most-named first; names that start with the
 * typing come before the rest. `matched` is the name that matched, when it is not his main one.
 */
export function suggest(
  data: RabbiData,
  typed: string,
  skip: readonly number[] = [],
): { place: number; matched: string | null }[] {
  const words = plain(typed).split(' ').filter(Boolean);
  if (!words.length) return [];
  const { sure, maybe } = indexFor(data);
  const found: { place: number; matched: string | null; starts: boolean }[] = [];
  data.rabbis.rabbis.forEach((rabbi, place) => {
    if (skip.includes(place)) return;
    const own = [rabbi.en, rabbi.he];
    for (const name of [...own, ...rabbi.names]) {
      const text = plain(name);
      if (words.every((w) => text.includes(w))) {
        found.push({
          place,
          matched: own.includes(name) ? null : name,
          starts: untitled(text).startsWith(words[0]),
        });
        return;
      }
    }
  });
  return found
    .sort(
      (a, b) =>
        Number(b.starts) - Number(a.starts) ||
        sure[b.place] + maybe[b.place] - (sure[a.place] + maybe[a.place]),
    )
    .slice(0, SUGGESTIONS);
}

/**
 * Degrees of OKLCH hue from an era's own, for the second pick onward. They lean away from the
 * neighbouring eras: the Amoraim toward cyan and back toward blue, never into the Mishnah's violet
 * (hue 302); the Tannaim toward amber and red-orange; the Zugot toward magenta and rose.
 */
const HUE_OFFSETS: Record<string, readonly number[]> = {
  Amoraim: [0, -40, 14, -66, -20, -90],
  Tannaim: [0, 22, -22, 36, -36, 50],
  Zugot: [0, 30, 54, -30, 72, -50],
};

/** How much of the gamut's edge the shared chroma may use, so no colour is clipped. */
const CHROMA_ROOM = 0.97;

/**
 * A colour for each rabbi, in order. A rabbi alone in his era has his generation's colour in
 * Dating. Rabbis of one era share the first one's lightness and a chroma every hue can reach, and
 * differ only in hue, so they look equally bright and are told apart by hue.
 */
export function pickColors(picked: readonly Rabbi[]): Color[] {
  const eras = picked.map((rabbi) => eraOf(rabbi.gen));
  const colors: Color[] = [];
  for (const era of new Set(eras)) {
    const group = picked.flatMap((_, i) => (eras[i] === era ? [i] : []));
    if (group.length === 1) {
      colors[group[0]] = generationColor(picked[group[0]].gen);
      continue;
    }
    const first = rgbToOklch(generationColor(picked[group[0]].gen));
    const hues = group.map((_, k) => (first.h + HUE_OFFSETS[era][k] + 360) % 360);
    const c = Math.min(first.c, ...hues.map((h) => maxChroma(first.l, h) * CHROMA_ROOM));
    group.forEach((i, k) => {
      colors[i] = oklchToRgb(first.l, c, hues[k]);
    });
  }
  return colors;
}

/** The link's value for the picks, and the picks a link's value names. */
export const picksToUrl = (picked: readonly string[]): string => picked.join(',');
export const picksFromUrl = (value: string | undefined): string[] =>
  [...new Set((value ?? '').split(',').filter(Boolean))].slice(0, MAX_PICKS);
