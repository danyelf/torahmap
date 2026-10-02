// The readings the haftarah overlay colours: the weekly portions and the special
// occasions, as handed in, and for each custom the lookups from a verse to the
// readings it belongs to.

import type { Color } from '../types.ts';
import type { TorahData } from '../../types.ts';
import { tanakhKey } from '../../types.ts';
import { hslToRgb } from '../../utils/color.ts';
import { STRUCTURE_FILE } from '../../verseTexts.ts';
import { memoByValueAndKey } from '../../utils/memo.ts';
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

export type OccasionCategory =
  | 'rosh-chodesh'
  | 'four-shabbatot'
  | 'high-holidays'
  | 'sukkot'
  | 'pesach'
  | 'shavuot'
  | 'fast-days'
  | 'other';

export interface SpecialOccasionData {
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

export function getItemColor(itemIndex: number, totalItemCount: number): Color {
  const hue = (itemIndex / totalItemCount) * 360;
  return hslToRgb({ h: hue, s: 0.8, l: 0.55 });
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

    // Parshiot take color indices 0..parshiot.length-1; special occasions
    // continue from there, so the rainbow runs across both without repeats.
    items.forEach((item, i) => {
      itemToColor.set(item, getItemColor(i, items.length));

      if (isParsha(item)) {
        forEachVerseInRange(data.structure, item.torah, (book, ch, v) => {
          torahVerseToParsha.set(tanakhKey(book, ch, v), item);
        });
      }

      // A haftarah verse can belong to multiple items, so accumulate into an array.
      const haftarahRanges = item.haftarah[custom];
      for (const range of haftarahRanges) {
        forEachVerseInRange(data.structure, range, (book, ch, v) => {
          const key = tanakhKey(book, ch, v);
          const existing = haftarahVerseToItem.get(key);
          if (existing) {
            existing.push(item);
          } else {
            haftarahVerseToItem.set(key, [item]);
          }
        });
      }
    });

    return {
      items,
      itemByName: new Map(items.map((item) => [item.name, item])),
      torahVerseToParsha,
      haftarahVerseToItem,
      itemToColor,
    };
  },
);
