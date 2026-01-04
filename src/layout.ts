// Layout algorithm: compute (x, y) position for every verse

import type { TorahData, Verse, Bounds } from './types.ts';

const VERSE_SIZE = 10;      // pixels per verse square
const CHAPTER_GAP = 3;      // gap between chapter rows
const BOOK_GAP = 20;        // gap between book columns

export function computeLayout(torahData: TorahData): Verse[] {
  const verses: Verse[] = [];
  let bookX = 0;

  for (const book of torahData.books) {
    let maxChapterWidth = 0;
    let chapterY = 0;

    for (let chapterIdx = 0; chapterIdx < book.chapters.length; chapterIdx++) {
      const verseCount = book.chapters[chapterIdx];

      for (let verseIdx = 0; verseIdx < verseCount; verseIdx++) {
        verses.push({
          book: book.name,
          chapter: chapterIdx + 1,
          verse: verseIdx + 1,
          x: bookX + verseIdx * VERSE_SIZE,
          y: chapterY,
          size: VERSE_SIZE
        });
      }

      maxChapterWidth = Math.max(maxChapterWidth, verseCount * VERSE_SIZE);
      chapterY += VERSE_SIZE + CHAPTER_GAP;
    }

    bookX += maxChapterWidth + BOOK_GAP;
  }

  return verses;
}

export function getLayoutBounds(verses: Verse[]): Bounds {
  let maxX = 0, maxY = 0;
  for (const v of verses) {
    maxX = Math.max(maxX, v.x + v.size);
    maxY = Math.max(maxY, v.y + v.size);
  }
  return { width: maxX, height: maxY };
}
