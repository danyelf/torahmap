// The readings the haftarah overlay colours: the weekly portions and the special
// occasions, loaded once, and for each custom the lookups from a verse to the
// readings it belongs to.

import type { Color } from '../types.ts';
import type { TorahData } from '../../types.ts';
import { tanakhKey } from '../../types.ts';
import { hslToRgb } from '../../utils/color.ts';
import { loadJson } from '../loadJson.ts';

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
  haftarah: {
    ashkenazi: VerseRange[];
    sephardi: VerseRange[];
  };
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
  haftarah: {
    ashkenazi: VerseRange[];
    sephardi: VerseRange[];
  };
}

export type HaftarahItem = ParshaData | SpecialOccasionData;

export function isParsha(item: HaftarahItem): item is ParshaData {
  return 'torah' in item;
}

export interface HaftarahMappings {
  parshiot: ParshaData[];
  specialOccasions: SpecialOccasionData[];
}

export const CUSTOMS = ['ashkenazi', 'sephardi'] as const;
export type Custom = (typeof CUSTOMS)[number];

let data: HaftarahMappings | null = null;
let structure: TorahData | null = null;

/** The readings, once loaded. */
export function mappings(): HaftarahMappings | null {
  return data;
}

export async function loadReadings(): Promise<void> {
  const [haftarahData, structureData] = await Promise.all([
    loadJson<HaftarahMappings>('overlays/haftarah/mappings.json'),
    loadJson<TorahData>('tanakh-structure.json'),
  ]);
  if (!haftarahData || !structureData) return;

  data = haftarahData;
  structure = structureData;
  // Both customs' derivations were built (if at all) from data that no
  // longer applies.
  derivationCache.clear();
}

export function getItemColor(itemIndex: number, totalItemCount: number): Color {
  const hue = (itemIndex / totalItemCount) * 360;
  return hslToRgb({ h: hue, s: 0.8, l: 0.55 });
}

/** Everything about a custom's readings that a verse's color depends on. */
export interface HaftarahDerivation {
  // Parshiot, then special occasions; a preview is a place in this list.
  items: HaftarahItem[];
  torahVerseToParsha: Map<string, ParshaData>;
  // Haftarah verses can belong to multiple items (parshiot or special occasions).
  haftarahVerseToItem: Map<string, HaftarahItem[]>;
  itemToColor: Map<HaftarahItem, Color>;
}

// There are only two customs, so keyed derivations are cheap to keep around
// rather than rebuilding one on every call.
const derivationCache = new Map<Custom, HaftarahDerivation>();

function getVerseCount(book: string, chapter: number): number {
  if (!structure) return 200; // Safe fallback
  const bookData = structure.books.find((b) => b.name === book);
  if (!bookData || chapter < 1 || chapter > bookData.chapters.length) {
    return 200; // Safe fallback
  }
  return bookData.chapters[chapter - 1];
}

export function forEachVerseInRange(
  range: VerseRange,
  callback: (book: string, chapter: number, verse: number) => void,
): void {
  for (let ch = range.start.chapter; ch <= range.end.chapter; ch++) {
    const startV = ch === range.start.chapter ? range.start.verse : 1;
    const maxV = getVerseCount(range.book, ch);
    const endV = ch === range.end.chapter ? Math.min(range.end.verse, maxV) : maxV;
    for (let v = startV; v <= endV; v++) {
      callback(range.book, ch, v);
    }
  }
}

/** The lookup indexes for one custom, from the loaded data. */
export function deriveHaftarah(custom: Custom): HaftarahDerivation {
  const cached = derivationCache.get(custom);
  if (cached) return cached;

  const torahVerseToParsha = new Map<string, ParshaData>();
  const haftarahVerseToItem = new Map<string, HaftarahItem[]>();
  const itemToColor = new Map<HaftarahItem, Color>();
  let items: HaftarahItem[] = [];

  if (data) {
    const specialOccasions = data.specialOccasions || [];
    items = [...data.parshiot, ...specialOccasions];

    // Parshiot take color indices 0..parshiot.length-1; special occasions
    // continue from there, so the rainbow runs across both without repeats.
    items.forEach((item, i) => {
      itemToColor.set(item, getItemColor(i, items.length));

      if (isParsha(item)) {
        forEachVerseInRange(item.torah, (book, ch, v) => {
          torahVerseToParsha.set(tanakhKey(book, ch, v), item);
        });
      }

      // A haftarah verse can belong to multiple items, so accumulate into an array.
      const haftarahRanges = item.haftarah[custom];
      for (const range of haftarahRanges) {
        forEachVerseInRange(range, (book, ch, v) => {
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
  }

  const derivation: HaftarahDerivation = {
    items,
    torahVerseToParsha,
    haftarahVerseToItem,
    itemToColor,
  };
  derivationCache.set(custom, derivation);
  return derivation;
}
