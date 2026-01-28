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
  chapters: number[];
}

export interface TorahData {
  books: Book[];
}

/**
 * Identity of a biblical verse.
 * The minimal information needed to uniquely identify a verse in Tanakh.
 */
export interface VerseIdentity {
  book: string;
  chapter: number;
  verse: number;
}

/**
 * Complete layout information for a verse.
 * Extends identity with spatial position computed during layout.
 * This data is immutable after initial layout computation.
 */
export interface VerseLayout extends VerseIdentity {
  x: number;
  y: number;
  size: number;
}

/**
 * Check if two verses refer to the same verse.
 * Handles null comparison for optional verse references (hover, pinned).
 *
 * @param a - First verse identity (or null)
 * @param b - Second verse identity (or null)
 * @returns true if both are null or both refer to same verse
 */
export function versesEqual(a: VerseIdentity | null, b: VerseIdentity | null): boolean {
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
export function nextVerse(verses: VerseLayout[], current: VerseIdentity): VerseLayout | null {
  const currentIndex = verses.findIndex(
    v => v.book === current.book && v.chapter === current.chapter && v.verse === current.verse
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
export function prevVerse(verses: VerseLayout[], current: VerseIdentity): VerseLayout | null {
  const currentIndex = verses.findIndex(
    v => v.book === current.book && v.chapter === current.chapter && v.verse === current.verse
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
export interface VerseState {
  hasOverlayColor: boolean;  // Does overlay provide a color?
  baseColor: [number, number, number] | [number, number, number][]; // Overlay color or default gray
  isHovered: boolean;         // Is mouse hovering this verse?
  isPinned: boolean;          // Is this verse pinned in sidebar?
}

export interface Bounds {
  width: number;
  height: number;
}

// Commentary counts from Sefaria
export interface VerseCommentary {
  total: number;
  categories: Record<string, number>;
}

export type CommentaryData = Record<string, Record<string, Record<string, VerseCommentary>>>;
// Structure: { [book]: { [chapter]: { [verse]: VerseCommentary } } }

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
export interface TropVerseLocation {
  book: string;
  chapter: number;
  verse: number;
  count: number;  // How many times this trop appears in this verse
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
export function getVerseKey(book: string, chapter: number, verse: number): string {
  return `${book}:${chapter}:${verse}`;
}
