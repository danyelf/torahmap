// Shared types for Torah Map
//
// The codebase separates domain knowledge (book/chapter/verse, commentary,
// trop, search, display formatting) from spatial rendering (position, size,
// geometry, hit detection, camera). SpatialItem<T> is the join: any domain
// identity T paired with x/y/size. The rendering pipeline only ever reads
// x/y/size, so a new corpus needs just a concrete identity type — see
// TalmudIdentity below — to reuse the whole pipeline unchanged.

/**
 * Which of a verse's two texts is in hand: the Hebrew or the English.
 *
 * It decides how text is folded for matching and where a word ends, so it
 * travels with the text rather than being guessed from it.
 */
export type TextLanguage = 'he' | 'en';

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
 * A spatial item is any domain identity paired with 2D coordinates and a size.
 * The rendering pipeline is generic over the identity type — it never reads
 * domain fields, only x/y/size.
 *
 * Usage:
 *   TanakhLayout = SpatialItem<TanakhIdentity>
 *   TalmudLayout = SpatialItem<TalmudIdentity>
 *
 * Any new corpus needs only a concrete identity interface to produce a new
 * SpatialItem<T> flavor; the spatial modules accept it via generics.
 */
export type SpatialItem<T> = T & {
  x: number;
  y: number;
  size: number;
};

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
export type TalmudLayout = SpatialItem<TalmudIdentity>;

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

/** Computed state for a single item: semantic state first, visual state second. */
export interface ItemState {
  hasOverlayColor: boolean;
  resolvedColor: [number, number, number] | [number, number, number][];
  isHovered: boolean;
  isPinned: boolean;
}

export interface Bounds {
  width: number;
  height: number;
}

// Commentary counts from Sefaria
export interface TanakhCommentary {
  total: number;
  categories: Record<string, number>;
}

export type CommentaryData = Record<string, Record<string, Record<string, TanakhCommentary>>>;
// Structure: { [book]: { [chapter]: { [verse]: TanakhCommentary } } }

export interface ShaderProgram {
  program: WebGLProgram;
  attribs: {
    position: number;
    color: number;
    color2: number;
    color3: number;
    color4: number;
    colorCount: number;
    uv: number;
    seed: number;
  };
  uniforms: {
    resolution: WebGLUniformLocation | null;
    pan: WebGLUniformLocation | null;
    zoom: WebGLUniformLocation | null;
    multiStyle: WebGLUniformLocation | null;
    bleed: WebGLUniformLocation | null;
    alpha: WebGLUniformLocation | null;
    curve: WebGLUniformLocation | null;
    edgeUnits: WebGLUniformLocation | null;
  };
}

// Trop index: maps trop unicode -> list of verse locations containing it
interface TropVerseLocation {
  book: string;
  chapter: number;
  verse: number;
  count: number; // How many times this trop appears in this verse
}

export interface TropIndexEntry {
  unicode: string;
  name: string;
  hebrewName: string;
  totalCount: number;
  verses: TropVerseLocation[];
}

export type TropIndex = Map<string, TropIndexEntry>;

// Verse key utilities for consistent key generation
export function tanakhKey(book: string, chapter: number, verse: number): string {
  return `${book}:${chapter}:${verse}`;
}
