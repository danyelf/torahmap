// Which passages name the picked rabbis, how to find a rabbi by any of his names, and the colour
// each pick gets. No page in here.

import { maxChroma, memoByValue, oklchToRgb, type Color } from '@torahmap/utils';
import { isSure, type Rabbi, type TalmudDating } from '../dating.ts';
import { ERAS, eraOf, eraText, TRANSITION } from './dating.ts';

export interface RabbiData {
  dating: TalmudDating;
}

export interface RabbiSettings {
  /** Sefaria slugs, in the order picked. */
  picked: string[];
}

/** At most this many rabbis picked: what the renderer can split one square into. */
export const MAX_PICKS = 4;
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

const build = (dating: TalmudDating): Index => {
  const { rabbis } = dating;
  const sure = rabbis.map(() => 0);
  const maybe = rabbis.map(() => 0);
  const naming = new Map<string, { entry: Omit<Entry, 'named'>; ids: Set<string> }>();
  for (const [id, segment] of Object.entries(dating.segments)) {
    for (const person of segment[2]) {
      const { who } = readingOf(dating, person);
      if (!who.length) continue;
      const one = who.length === 1;
      const key = one ? `r${who[0]}` : `p${person}`;
      if (!naming.has(key)) {
        const { en, he } = one ? rabbis[who[0]] : dating.people[person];
        const gen = one ? rabbis[who[0]].gen : dating.generations[dating.people[person].gen].code;
        naming.set(key, { entry: { rabbis: who, en, he, gen, single: one }, ids: new Set() });
      }
      naming.get(key)!.ids.add(id);
    }
    for (const [r, how] of standingIn({ dating }, id)) (how === 'sure' ? sure : maybe)[r]++;
  }
  return {
    placeOf: new Map(rabbis.map((r, i) => [r.id, i])),
    sure,
    maybe,
    entries: [...naming.values()]
      .map(({ entry, ids }) => ({ ...entry, named: ids.size }))
      .sort((a, b) => b.named - a.named),
  };
};

const indexOf = memoByValue(build);
const indexFor = ({ dating }: RabbiData): Index => indexOf(dating);

/** The picked rabbis' places, in the order picked; slugs the data does not hold are dropped. */
export function pickedPlaces(settings: RabbiSettings, data: RabbiData): number[] {
  const { placeOf } = indexFor(data);
  return settings.picked.flatMap((id) => placeOf.get(id) ?? []);
}

/** What a person's name can mean: whether it is certain, and the rabbis it can be. */
export function readingOf(
  { people }: TalmudDating,
  person: number,
): { sure: boolean; who: number[] } {
  return { sure: isSure(people[person]), who: people[person].means };
}

/** How each rabbi a passage may name stands in it: certain where any one name settles him. */
function standingIn({ dating }: RabbiData, id: string): Map<number, Certainty> {
  const found = new Map<number, Certainty>();
  for (const person of dating.segments[id]?.[2] ?? []) {
    const { sure, who } = readingOf(dating, person);
    for (const r of who) if (sure || !found.has(r)) found.set(r, sure ? 'sure' : 'maybe');
  }
  return found;
}

/** How each of `places` stands in a passage, for those it names. */
export const namedIn = (data: RabbiData, id: string, places: readonly number[]) =>
  new Map([...standingIn(data, id)].filter(([place]) => places.includes(place)));

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
const plain = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-֑ͯ-ׇ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** A name without the title in front: "rabban gamliel" is found under G. */
const untitled = (name: string): string =>
  name.replace(/^(?:(?:rabban|rabbi|rebbi|rav|rabi|r|רבן|רבי|רב|ר) )+/u, '');

/** A rabbi's generation and its years, as "5th-gen Tanna, 135–170"; "Undated" has no years. */
export const eraLine = (rabbi: Rabbi, { generations }: TalmudDating): string =>
  eraText(
    rabbi.gen,
    generations.find((g) => g.code === rabbi.gen),
  );

/**
 * A name where space is short: "R. Meir ר׳ מאיר". "Rabbi" and רבי are shortened where a name
 * follows them, so "Rabbi Shimon b. Rabbi" keeps its last word.
 */
export function shortName({ en, he }: Rabbi): string {
  const short = [
    en.replace(/\bRabbi\b(?= \S)/g, 'R.'),
    he.replace(/(?<![א-ת])רבי(?= [א-ת])/gu, 'ר׳'),
  ];
  return short.filter(Boolean).join(' ');
}

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
  data.dating.rabbis.forEach((rabbi, place) => {
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
 * The OKLCH hue of each pick, in the order picked, and how much of the gamut's edge its chroma
 * uses. Four hues far apart: cyan, coral, green, pink. The green is held back, since at full
 * chroma it reads harsher than the others at the same lightness.
 */
const PICKS: readonly { hue: number; chroma: number }[] = [
  { hue: 215, chroma: 0.97 },
  { hue: 35, chroma: 0.97 },
  { hue: 150, chroma: 0.6 },
  { hue: 330, chroma: 0.97 },
];
/** Every pick is this light, so none looks brighter than another. */
const PICK_LIGHTNESS = 0.8;

/** A color for each rabbi, by the order picked. */
export function pickColors(picked: readonly Rabbi[]): Color[] {
  return picked.map((_, i) => {
    const { hue, chroma } = PICKS[i];
    return oklchToRgb(PICK_LIGHTNESS, maxChroma(PICK_LIGHTNESS, hue) * chroma, hue);
  });
}

/** The link's value for the picks, and the picks a link's value names. */
export const picksToUrl = (picked: readonly string[]): string => picked.join(',');
export const picksFromUrl = (value: string | undefined): string[] =>
  [...new Set((value ?? '').split(',').filter(Boolean))].slice(0, MAX_PICKS);
