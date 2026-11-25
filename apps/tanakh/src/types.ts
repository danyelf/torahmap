// The Tanakh's own types: its books, its layout's settings, and a verse's place.
import type { SpatialItem } from '@torahmap/engine';

export interface Book {
  name: string;
  hebrewName: string;
  section: 'torah' | 'neviim' | 'ketuvim';
  chapters: number[];
  /** The book it counts as in the traditional 24: Samuel, Kings, Chronicles, Ezra–Nehemiah, The Twelve, or its own name. */
  countedAs: string;
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
 * Identity of a Tanakh verse. Three levels: book, chapter, verse.
 */
export interface TanakhIdentity {
  book: string;
  chapter: number;
  verse: number;
}

export type TanakhLayout = SpatialItem<TanakhIdentity>;
