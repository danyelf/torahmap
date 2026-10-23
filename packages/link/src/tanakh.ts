// A Tanakh verse's id, the name its links and squares give it.

import { bookFromUrl, bookToUrl } from './link.ts';

// Allows letters (including Hebrew), spaces, and dots, for names like "I.Samuel".
function validateBookName(book: string): boolean {
  if (!book || book.trim() === '') return false;
  return /^[a-zA-Z\u0590-\u05FF\s.]+$/.test(book);
}

/** A verse's id, the one name every part of the app uses for it: "I Samuel" 1:5 -> "I.Samuel.1.5". */
export function verseId(book: string, chapter: number, verse: number): string {
  return `${bookToUrl(book)}.${chapter}.${verse}`;
}

/** A verse as readers write it: "I Samuel 1:5". */
export function verseRef(v: { book: string; chapter: number; verse: number }): string {
  return passageRef(v.book, v);
}

/** A chapter, or a verse of one. */
export interface ChapterPlace {
  chapter: number;
  verse?: number;
}

const at = (p: ChapterPlace) =>
  p.verse === undefined ? `${p.chapter}` : `${p.chapter}:${p.verse}`;

/** A passage of `book` as readers write it: "Genesis 1", "Genesis 1:3", "Genesis 1:3-5", "Genesis 1:3-2:4". */
export function passageRef(book: string, from: ChapterPlace, to: ChapterPlace = from): string {
  if (to.chapter === from.chapter && to.verse === from.verse) return `${book} ${at(from)}`;
  const end = to.chapter === from.chapter && from.verse !== undefined ? `${to.verse}` : at(to);
  return `${book} ${at(from)}-${end}`;
}

/**
 * Read a verse id: "I.Samuel.1.5" -> { book: "I Samuel", chapter: 1, verse: 5 },
 * or null for anything verseId would not write.
 */
export function parseVerseId(
  verseStr: string,
): { book: string; chapter: number; verse: number } | null {
  // Split from the end to handle book names with dots, e.g. "I.Samuel.1.5".
  const parts = verseStr.split('.');
  if (parts.length < 3) return null;
  if (parts.length > 5) return null; // max 3 parts for book name + 2 for chapter/verse

  const verseStr_ = parts.pop()!;
  const chapterStr = parts.pop()!;
  const book = bookFromUrl(parts.join('.'));

  const verse = parseInt(verseStr_, 10);
  const chapter = parseInt(chapterStr, 10);

  if (isNaN(verse) || isNaN(chapter)) return null;
  if (verse < 0 || chapter < 0) return null;

  // No book has >200 chapters, no chapter has >200 verses
  if (chapter > 200 || verse > 200) return null;

  if (!validateBookName(book)) return null;

  // A verse's square is found by its exact id, so "Genesis.01.1" names none.
  return verseId(book, chapter, verse) === verseStr ? { book, chapter, verse } : null;
}
