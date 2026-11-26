// The readings the haftarah overlay colors: the weekly portions and the special
// occasions, as handed in, and for each custom the lookups from a verse to the
// readings it belongs to.

import { type Color, hslToRgb, memoByValueAndKey } from '@torahmap/utils';
import type { TorahData } from '../../types.ts';
import { verseId } from '@torahmap/link/tanakh';
import { STRUCTURE_FILE } from '../../verseTexts.ts';
import { HAFTARAH_CUSTOMS } from '@torahmap/overlay-catalog';

interface VerseRef {
  chapter: number;
  verse: number;
}

export interface VerseRange {
  book: string;
  start: VerseRef;
  end: VerseRef;
}

export interface ParshaData {
  name: string;
  hebrewName: string;
  torah: VerseRange;
  haftarah: Record<Custom, VerseRange[]>;
}

/** In the order the legend lists them, and the order their colors step through. */
export const OCCASION_CATEGORIES = [
  'high-holidays',
  'sukkot',
  'four-shabbatot',
  'pesach',
  'shavuot',
  'fast-days',
  'rosh-chodesh',
  'other',
] as const;

export type OccasionCategory = (typeof OCCASION_CATEGORIES)[number];

interface SpecialOccasionData {
  name: string;
  hebrewName: string;
  category: OccasionCategory;
  haftarah: Record<Custom, VerseRange[]>;
}

export type HaftarahItem = ParshaData | SpecialOccasionData;

export function isParsha(item: HaftarahItem): item is ParshaData {
  return 'torah' in item;
}

export interface HaftarahMappings {
  parshiot: ParshaData[];
  specialOccasions: SpecialOccasionData[];
}

export type Custom = (typeof HAFTARAH_CUSTOMS)[number];

export const HAFTARAH_FILES = {
  mappings: 'overlays/haftarah/mappings.json',
  structure: STRUCTURE_FILE,
} as const;

export interface HaftarahData {
  mappings: HaftarahMappings;
  structure: TorahData;
}

// Each Torah book has a hue band, centered where the books stay apart on the color wheel and
// clear of the holidays' magenta. A portion's place in its book moves it across the band, so a
// run of portions reads as one family; its place in a lightness ramp is a second cue, and
// alternating light and dark tells neighbors apart. Per-book lightness offsets keep the books
// apart for a reader who cannot tell their hues.
const BOOK_HUES: Record<string, { hue: number; lightness: number }> = {
  Genesis: { hue: 15, lightness: -0.05 },
  Exodus: { hue: 65, lightness: 0.05 },
  Leviticus: { hue: 130, lightness: -0.05 },
  Numbers: { hue: 195, lightness: 0 },
  Deuteronomy: { hue: 250, lightness: 0.05 },
};
const BOOK_HUE_SPAN = 50;
const BOOK_LIGHTNESS_RAMP = 0.12;
const NEIGHBOR_LIGHTNESS = 0.08;
const BASE_LIGHTNESS = 0.57;

// The holidays take magenta, which no book does and the map's background is not. Each category
// has its own hue, and its readings step along a lightness ramp.
const OCCASION_HUE = 296;
const OCCASION_CATEGORY_STEP = 7;
const OCCASION_LIGHTNESS = { from: 0.45, to: 0.7 };

/** `index` of `count` positions, as 0 to 1. */
function along(index: number, count: number): number {
  return count > 1 ? index / (count - 1) : 0.5;
}

/** A reading's color from its place among the readings of its book (a portion) or its category (an occasion). */
export function readingColor(item: HaftarahItem, data: HaftarahMappings): Color {
  if (isParsha(item)) {
    const book = item.torah.book;
    const mates = data.parshiot.filter((p) => p.torah.book === book);
    const k = mates.indexOf(item);
    const t = along(k, mates.length) - 0.5;
    const { hue, lightness } = BOOK_HUES[book];
    return hslToRgb({
      h: (hue + t * BOOK_HUE_SPAN + 360) % 360,
      s: 0.8,
      l:
        BASE_LIGHTNESS +
        lightness +
        t * BOOK_LIGHTNESS_RAMP +
        (k % 2 === 0 ? -NEIGHBOR_LIGHTNESS : NEIGHBOR_LIGHTNESS),
    });
  }
  const mates = data.specialOccasions.filter((o) => o.category === item.category);
  const k = mates.indexOf(item);
  const category = OCCASION_CATEGORIES.indexOf(item.category);
  return hslToRgb({
    h: OCCASION_HUE + category * OCCASION_CATEGORY_STEP,
    s: 0.8,
    l:
      OCCASION_LIGHTNESS.from +
      (OCCASION_LIGHTNESS.to - OCCASION_LIGHTNESS.from) * along(k, mates.length),
  });
}

/** Everything about a custom's readings that a verse's color depends on. */
export interface HaftarahDerivation {
  // Parshiot, then special occasions.
  items: HaftarahItem[];
  // No two readings share a name.
  itemByName: Map<string, HaftarahItem>;
  torahVerseToParsha: Map<string, ParshaData>;
  // Haftarah verses can belong to multiple items (parshiot or special occasions).
  haftarahVerseToItem: Map<string, HaftarahItem[]>;
  itemToColor: Map<HaftarahItem, Color>;
}

function getVerseCount(structure: TorahData, book: string, chapter: number): number {
  const bookData = structure.books.find((b) => b.name === book);
  if (!bookData || chapter < 1 || chapter > bookData.chapters.length) {
    return 200; // Safe fallback
  }
  return bookData.chapters[chapter - 1];
}

export function forEachVerseInRange(
  structure: TorahData,
  range: VerseRange,
  callback: (book: string, chapter: number, verse: number) => void,
): void {
  for (let ch = range.start.chapter; ch <= range.end.chapter; ch++) {
    const startV = ch === range.start.chapter ? range.start.verse : 1;
    const maxV = getVerseCount(structure, range.book, ch);
    const endV = ch === range.end.chapter ? Math.min(range.end.verse, maxV) : maxV;
    for (let v = startV; v <= endV; v++) {
      callback(range.book, ch, v);
    }
  }
}

/** The lookup indexes for one custom, from the readings handed in; worked out once per data value. */
export const deriveHaftarah = memoByValueAndKey(
  (data: HaftarahData, custom: Custom): HaftarahDerivation => {
    const torahVerseToParsha = new Map<string, ParshaData>();
    const haftarahVerseToItem = new Map<string, HaftarahItem[]>();
    const itemToColor = new Map<HaftarahItem, Color>();
    const items: HaftarahItem[] = [...data.mappings.parshiot, ...data.mappings.specialOccasions];

    for (const item of items) {
      itemToColor.set(item, readingColor(item, data.mappings));

      if (isParsha(item)) {
        forEachVerseInRange(data.structure, item.torah, (book, ch, v) => {
          torahVerseToParsha.set(verseId(book, ch, v), item);
        });
      }

      // A haftarah verse can belong to multiple items, so accumulate into an array.
      const haftarahRanges = item.haftarah[custom];
      for (const range of haftarahRanges) {
        forEachVerseInRange(data.structure, range, (book, ch, v) => {
          const key = verseId(book, ch, v);
          const existing = haftarahVerseToItem.get(key);
          if (existing) {
            existing.push(item);
          } else {
            haftarahVerseToItem.set(key, [item]);
          }
        });
      }
    }

    return {
      items,
      itemByName: new Map(items.map((item) => [item.name, item])),
      torahVerseToParsha,
      haftarahVerseToItem,
      itemToColor,
    };
  },
);
