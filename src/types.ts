// Shared types for Torah Map

/** Red, green and blue, each 0 to 1. */
export type Color = [number, number, number];

/** A verse's colour, or its stripes. */
export type VerseColor = Color | Color[];

export const HEBREW = 'he';
export const ENGLISH = 'en';

/**
 * Which of a verse's two texts is in hand: the Hebrew or the English.
 *
 * It decides how text is folded for matching and where a word ends, so it
 * travels with the text rather than being guessed from it.
 */
export type TextLanguage = typeof HEBREW | typeof ENGLISH;

export interface Book {
  name: string;
  hebrewName: string;
  section: 'torah' | 'neviim' | 'ketuvim';
  chapters: number[];
}

export interface LayoutConfig {
  minorProphetStacks: string[][];
  ketuvimStacks: Array<{ books: string[]; insertAfter: string }>;
  multiColumnBooks: Record<string, { splitAtChapter: number }>;
}

export interface TorahData {
  books: Book[];
  layout: LayoutConfig;
}

/**
 * A square on the map. Its id is its link form, so the app compares, finds
 * and links squares by id without knowing what they hold. Drawing, hit
 * testing and the camera read only this.
 */
export interface MapItem {
  id: string;
  x: number;
  y: number;
  size: number;
}

/** A text's own fields (book, chapter and verse; or a Talmud segment) on a square. */
export type SpatialItem<T> = T & MapItem;

/**
 * Identity of a Tanakh verse. Three levels: book, chapter, verse.
 */
export interface TanakhIdentity {
  book: string;
  chapter: number;
  verse: number;
}

/**
 * Identity of a Talmud segment. Four levels: tractate, daf, amud, segment.
 * Dapim start at 2 in standard printings (there is no daf 1).
 */
export interface TalmudIdentity {
  tractate: string;
  daf: number;
  amud: 'a' | 'b';
  segment: number;
}

export type TanakhLayout = SpatialItem<TanakhIdentity>;

/** True if both are null, or both refer to the same verse. */
export function tanakhIdentitiesEqual(a: TanakhIdentity | null, b: TanakhIdentity | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;
}

/** The laid-out verse with this identity, or null if the map does not hold it. */
export function findTanakhItem(verses: TanakhLayout[], id: TanakhIdentity): TanakhLayout | null {
  return verses.find((v) => tanakhIdentitiesEqual(v, id)) ?? null;
}

/** Next verse in layout order, or null if current is last or not found. */
export function nextTanakhItem(
  verses: TanakhLayout[],
  current: TanakhIdentity,
): TanakhLayout | null {
  const currentIndex = verses.findIndex((v) => tanakhIdentitiesEqual(v, current));

  if (currentIndex === -1 || currentIndex >= verses.length - 1) {
    return null;
  }

  return verses[currentIndex + 1];
}

/** Previous verse in layout order, or null if current is first or not found. */
export function prevTanakhItem(
  verses: TanakhLayout[],
  current: TanakhIdentity,
): TanakhLayout | null {
  const currentIndex = verses.findIndex((v) => tanakhIdentitiesEqual(v, current));

  if (currentIndex <= 0) {
    return null;
  }

  return verses[currentIndex - 1];
}

export interface Bounds {
  width: number;
  height: number;
}

// Verse key utilities for consistent key generation
export function tanakhKey(book: string, chapter: number, verse: number): string {
  return `${book}:${chapter}:${verse}`;
}
