// Shared types for Torah Map

/**
 * ARCHITECTURE: Domain vs Spatial Separation
 *
 * This codebase separates domain knowledge (Torah structure) from spatial rendering.
 * This enables future abstraction to other structured texts (Quran, Talmud, etc).
 *
 * DOMAIN LAYER (Torah-specific):
 * - VerseIdentity: References a biblical verse (book/chapter/verse)
 * - Data loaders: layout.ts, verseTexts.ts, overlay data loading
 * - Overlays: Implement domain logic (commentary, trop, search, text dating, etc)
 * - Display: Sidebar, URL state (formatting "Genesis 1:1")
 *
 * SPATIAL LAYER (domain-agnostic):
 * - VerseLayout: Position and size in 2D space (x, y, size)
 * - Rendering: geometry.ts, rendering.ts, webgl.ts
 * - Interaction: hitDetection.ts, mouse handling
 * - Camera: zoom, pan (camera.ts)
 *
 * To adapt this codebase for another text:
 * 1. Redefine VerseIdentity structure
 * 2. Replace data loaders
 * 3. Implement domain-specific overlays
 * 4. Update display formatting
 * The entire rendering pipeline remains unchanged.
 */

export interface Book {
  name: string;
  hebrewName: string;
  section: "torah" | "neviim" | "ketuvim";
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

// ============================================================================
// Corpus-generic identity types (Talmud integration — tm-f28x)
// ============================================================================

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
  amud: "a" | "b";
  segment: number;
}

export type TanakhLayout = SpatialItem<TanakhIdentity>;
export type TalmudLayout = SpatialItem<TalmudIdentity>;

/**
 * Identity of a biblical verse.
 * @deprecated Use TanakhIdentity in new code. Alias kept for backwards compat.
 */
export type VerseIdentity = TanakhIdentity;

/**
 * Complete layout information for a verse.
 * @deprecated Use TanakhLayout in new code. Alias kept for backwards compat.
 */
export type VerseLayout = SpatialItem<TanakhIdentity>;

/**
 * Check if two verses refer to the same verse.
 * Handles null comparison for optional verse references (hover, pinned).
 *
 * @param a - First verse identity (or null)
 * @param b - Second verse identity (or null)
 * @returns true if both are null or both refer to same verse
 */
export function tanakhIdentitiesEqual(
  a: VerseIdentity | null,
  b: VerseIdentity | null,
): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.book === b.book && a.chapter === b.chapter && a.verse === b.verse;
}

/**
 * Find the next verse in the layout array.
 *
 * @param verses - Array of all verses in layout order
 * @param current - Current verse
 * @returns Next verse or null if current is last verse or not found
 */
export function nextTanakhItem(
  verses: VerseLayout[],
  current: VerseIdentity,
): VerseLayout | null {
  const currentIndex = verses.findIndex(
    (v) =>
      v.book === current.book &&
      v.chapter === current.chapter &&
      v.verse === current.verse,
  );

  if (currentIndex === -1 || currentIndex >= verses.length - 1) {
    return null;
  }

  return verses[currentIndex + 1];
}

/**
 * Find the previous verse in the layout array.
 *
 * @param verses - Array of all verses in layout order
 * @param current - Current verse
 * @returns Previous verse or null if current is first verse or not found
 */
export function prevTanakhItem(
  verses: VerseLayout[],
  current: VerseIdentity,
): VerseLayout | null {
  const currentIndex = verses.findIndex(
    (v) =>
      v.book === current.book &&
      v.chapter === current.chapter &&
      v.verse === current.verse,
  );

  if (currentIndex <= 0) {
    return null;
  }

  return verses[currentIndex - 1];
}

/**
 * Computed state for a single verse during rendering.
 * First pass: semantic state (what is true about this verse)
 * Second pass: visual state (how to render it)
 */
export interface ItemState {
  hasOverlayColor: boolean; // Does overlay provide a color?
  resolvedColor: [number, number, number] | [number, number, number][]; // Final color: overlay color if present, otherwise default gray
  isHovered: boolean; // Is mouse hovering this verse?
  isPinned: boolean; // Is this verse pinned in sidebar?
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

export type CommentaryData = Record<
  string,
  Record<string, Record<string, TanakhCommentary>>
>;
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
export function tanakhKey(
  book: string,
  chapter: number,
  verse: number,
): string {
  return `${book}:${chapter}:${verse}`;
}
