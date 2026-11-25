// What the page knows of each book, and every verse in reading order.
// Populated at runtime from tanakh-structure.json via initBookData()

import { verseId } from '@torahmap/link/tanakh';
import type { Book, TanakhIdentity, TorahData } from './types.ts';

export interface Place extends TanakhIdentity {
  id: string;
}

const bookMap = new Map<string, Book>();
let places: Place[] = [];
const positions = new Map<string, number>();
let initialized = false;

/**
 * Initialize book metadata from loaded structure data.
 * Must be called after loading TorahData, before any lookups.
 */
export function initBookData(data: TorahData): void {
  bookMap.clear();
  positions.clear();
  places = [];
  for (const book of data.books) {
    bookMap.set(book.name, book);
    book.chapters.forEach((verses, c) => {
      for (let verse = 1; verse <= verses; verse++) {
        const id = verseId(book.name, c + 1, verse);
        positions.set(id, places.length);
        places.push({ id, book: book.name, chapter: c + 1, verse });
      }
    });
  }
  initialized = true;
}

function assertInitialized(): void {
  if (!initialized) {
    throw new Error('initBookData() must be called before using book lookups');
  }
}

export function getBookSection(bookName: string): 'torah' | 'neviim' | 'ketuvim' {
  assertInitialized();
  return bookMap.get(bookName)?.section ?? 'neviim';
}

/** The book `bookName` counts as in the traditional 24. */
export function countedAs(bookName: string): string {
  assertInitialized();
  return bookMap.get(bookName)?.countedAs ?? bookName;
}

/** Every verse from Genesis 1:1, and each verse's position by id. */
export function readingOrder(): {
  places: readonly Place[];
  positions: ReadonlyMap<string, number>;
} {
  assertInitialized();
  return { places, positions };
}
