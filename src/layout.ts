// Layout algorithm: compute (x, y) position for every verse

import type { TorahData, Verse, Bounds, Book } from './types.ts';

const VERSE_SIZE = 6;       // pixels per verse square
const CHAPTER_GAP = 2;      // gap between chapter rows
const BOOK_GAP = 12;        // gap between book columns
const SECTION_GAP = 40;     // gap between Torah/Nevi'im/Ketuvim sections

// Section definitions for Tanakh
const TORAH_BOOKS = new Set(['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']);
const KETUVIM_BOOKS = new Set([
  'Psalms', 'Proverbs', 'Job', 'Song of Songs', 'Ruth',
  'Lamentations', 'Ecclesiastes', 'Esther', 'Daniel',
  'Ezra', 'Nehemiah', 'I Chronicles', 'II Chronicles'
]);

function getSection(bookName: string): 'torah' | 'neviim' | 'ketuvim' {
  if (TORAH_BOOKS.has(bookName)) return 'torah';
  if (KETUVIM_BOOKS.has(bookName)) return 'ketuvim';
  return 'neviim';
}

// Seeded random for deterministic jitter (same layout every time)
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Lay out a single section (row of books) and return its height
function layoutSection(
  books: Book[],
  sectionY: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): number {
  let bookX = 0;
  let maxSectionHeight = 0;

  for (const book of books) {
    let maxChapterWidth = 0;
    let chapterY = sectionY;

    for (let chapterIdx = 0; chapterIdx < book.chapters.length; chapterIdx++) {
      const verseCount = book.chapters[chapterIdx];

      for (let verseIdx = 0; verseIdx < verseCount; verseIdx++) {
        // Position jitter (±1px) to break up regular grid
        const jitterX = (seededRandom(globalVerseIdx.value * 2) - 0.5) * 2.0;
        const jitterY = (seededRandom(globalVerseIdx.value * 2 + 1) - 0.5) * 2.0;

        // Wider brightness variation (0.4 to 0.8)
        const brightness = 0.4 + seededRandom(globalVerseIdx.value * 3) * 0.4;

        verses.push({
          book: book.name,
          chapter: chapterIdx + 1,
          verse: verseIdx + 1,
          x: bookX + verseIdx * VERSE_SIZE + jitterX,
          y: chapterY + jitterY,
          size: VERSE_SIZE,
          color: [brightness, brightness, brightness]
        });

        globalVerseIdx.value++;
      }

      maxChapterWidth = Math.max(maxChapterWidth, verseCount * VERSE_SIZE);
      chapterY += VERSE_SIZE + CHAPTER_GAP;
    }

    // Track the tallest book in this section
    const bookHeight = chapterY - sectionY;
    maxSectionHeight = Math.max(maxSectionHeight, bookHeight);

    bookX += maxChapterWidth + BOOK_GAP;
  }

  return maxSectionHeight;
}

export function computeLayout(torahData: TorahData): Verse[] {
  const verses: Verse[] = [];
  const globalVerseIdx = { value: 0 };

  // Group books by section
  const torah: Book[] = [];
  const neviim: Book[] = [];
  const ketuvim: Book[] = [];

  for (const book of torahData.books) {
    const section = getSection(book.name);
    if (section === 'torah') torah.push(book);
    else if (section === 'neviim') neviim.push(book);
    else ketuvim.push(book);
  }

  // Layout each section vertically stacked
  let sectionY = 0;

  // Torah
  const torahHeight = layoutSection(torah, sectionY, globalVerseIdx, verses);
  sectionY += torahHeight + SECTION_GAP;

  // Nevi'im
  const neviimHeight = layoutSection(neviim, sectionY, globalVerseIdx, verses);
  sectionY += neviimHeight + SECTION_GAP;

  // Ketuvim
  layoutSection(ketuvim, sectionY, globalVerseIdx, verses);

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
