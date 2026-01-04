// Layout algorithm: compute (x, y) position for every verse

import type { TorahData, Verse, Bounds, Book } from './types.ts';

const VERSE_SIZE = 6;           // pixels per verse square
const CHAPTER_GAP = 2;          // gap between chapter rows
const BOOK_GAP = 12;            // gap between book columns
const SECTION_GAP = 70;         // gap between Torah/Nevi'im/Ketuvim sections
const STACKED_BOOK_GAP = 20;    // gap between vertically stacked books
const WRAP_THRESHOLD = 50;      // wrap chapters longer than this
const WRAP_INDENT = 12;         // indent for wrapped lines (2 verse widths)
const PSALMS_COLUMN_GAP = 15;   // gap between Psalms columns

// Section definitions for Tanakh
const TORAH_BOOKS = new Set(['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']);
const KETUVIM_BOOKS = new Set([
  'Psalms', 'Proverbs', 'Job', 'Song of Songs', 'Ruth',
  'Lamentations', 'Ecclesiastes', 'Esther', 'Daniel',
  'Ezra', 'Nehemiah', 'I Chronicles', 'II Chronicles'
]);

// Minor prophets stacking: each array is a vertical stack (top to bottom)
const MINOR_PROPHET_STACKS = [
  ['Hosea', 'Joel'],
  ['Amos', 'Obadiah', 'Jonah'],
  ['Micah', 'Nahum', 'Habakkuk'],
  ['Zephaniah', 'Haggai'],
  ['Zechariah', 'Malachi']
];

const MINOR_PROPHETS = new Set(MINOR_PROPHET_STACKS.flat());

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

// Layout a single chapter, handling wrapping for long chapters
function layoutChapter(
  bookName: string,
  chapterIdx: number,
  verseCount: number,
  bookX: number,
  chapterY: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): { width: number; height: number } {
  let maxWidth = 0;
  let currentX = bookX;
  let currentY = chapterY;
  let lineVerseCount = 0;
  let lineNumber = 0;

  for (let verseIdx = 0; verseIdx < verseCount; verseIdx++) {
    // Check if we need to wrap
    if (lineVerseCount >= WRAP_THRESHOLD) {
      // Start new line with indent
      lineNumber++;
      lineVerseCount = 0;
      currentX = bookX + WRAP_INDENT;
      currentY += VERSE_SIZE + CHAPTER_GAP;
    }

    // Position jitter (±1px) to break up regular grid
    const jitterX = (seededRandom(globalVerseIdx.value * 2) - 0.5) * 2.0;
    const jitterY = (seededRandom(globalVerseIdx.value * 2 + 1) - 0.5) * 2.0;

    // Wider brightness variation (0.4 to 0.8)
    const brightness = 0.4 + seededRandom(globalVerseIdx.value * 3) * 0.4;

    const x = currentX + lineVerseCount * VERSE_SIZE + jitterX;

    verses.push({
      book: bookName,
      chapter: chapterIdx + 1,
      verse: verseIdx + 1,
      x: x,
      y: currentY + jitterY,
      size: VERSE_SIZE,
      color: [brightness, brightness, brightness]
    });

    maxWidth = Math.max(maxWidth, (lineVerseCount + 1) * VERSE_SIZE + (lineNumber > 0 ? WRAP_INDENT : 0));
    lineVerseCount++;
    globalVerseIdx.value++;
  }

  const totalHeight = (lineNumber + 1) * (VERSE_SIZE + CHAPTER_GAP);
  return { width: maxWidth, height: totalHeight };
}

// Layout a single book and return its dimensions
function layoutBook(
  book: Book,
  bookX: number,
  bookY: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): { width: number; height: number } {
  let maxWidth = 0;
  let currentY = bookY;

  for (let chapterIdx = 0; chapterIdx < book.chapters.length; chapterIdx++) {
    const verseCount = book.chapters[chapterIdx];
    const { width, height } = layoutChapter(
      book.name,
      chapterIdx,
      verseCount,
      bookX,
      currentY,
      globalVerseIdx,
      verses
    );
    maxWidth = Math.max(maxWidth, width);
    currentY += height;
  }

  return { width: maxWidth, height: currentY - bookY };
}

// Layout Psalms in two columns (Books 1-2 and Books 3-5)
function layoutPsalms(
  book: Book,
  bookX: number,
  bookY: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): { width: number; height: number } {
  // Split at chapter 72 (end of Book 2)
  const splitPoint = 72;

  // Column A: chapters 1-72
  let colAY = bookY;
  let colAWidth = 0;
  for (let chapterIdx = 0; chapterIdx < splitPoint; chapterIdx++) {
    const verseCount = book.chapters[chapterIdx];
    const { width, height } = layoutChapter(
      book.name,
      chapterIdx,
      verseCount,
      bookX,
      colAY,
      globalVerseIdx,
      verses
    );
    colAWidth = Math.max(colAWidth, width);
    colAY += height;
  }
  const colAHeight = colAY - bookY;

  // Column B: chapters 73-150
  const colBX = bookX + colAWidth + PSALMS_COLUMN_GAP;
  let colBY = bookY;
  let colBWidth = 0;
  for (let chapterIdx = splitPoint; chapterIdx < book.chapters.length; chapterIdx++) {
    const verseCount = book.chapters[chapterIdx];
    const { width, height } = layoutChapter(
      book.name,
      chapterIdx,
      verseCount,
      colBX,
      colBY,
      globalVerseIdx,
      verses
    );
    colBWidth = Math.max(colBWidth, width);
    colBY += height;
  }
  const colBHeight = colBY - bookY;

  return {
    width: colAWidth + PSALMS_COLUMN_GAP + colBWidth,
    height: Math.max(colAHeight, colBHeight)
  };
}

// Layout minor prophets with vertical stacking
function layoutMinorProphets(
  books: Book[],
  startX: number,
  sectionY: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): { width: number; height: number } {
  const bookMap = new Map(books.map(b => [b.name, b]));
  let currentX = startX;
  let maxHeight = 0;

  for (const stack of MINOR_PROPHET_STACKS) {
    let stackY = sectionY;
    let stackWidth = 0;

    for (const bookName of stack) {
      const book = bookMap.get(bookName);
      if (!book) continue;

      const { width, height } = layoutBook(book, currentX, stackY, globalVerseIdx, verses);
      stackWidth = Math.max(stackWidth, width);
      stackY += height + STACKED_BOOK_GAP;
    }

    maxHeight = Math.max(maxHeight, stackY - sectionY - STACKED_BOOK_GAP);
    currentX += stackWidth + BOOK_GAP;
  }

  return { width: currentX - startX - BOOK_GAP, height: maxHeight };
}

// Layout Nevi'im section (Former Prophets + Latter Prophets + stacked Minor Prophets)
function layoutNeviim(
  books: Book[],
  sectionY: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): number {
  let bookX = 0;
  let maxHeight = 0;

  // Separate major prophets from minor prophets
  const majorProphets: Book[] = [];
  const minorProphets: Book[] = [];

  for (const book of books) {
    if (MINOR_PROPHETS.has(book.name)) {
      minorProphets.push(book);
    } else {
      majorProphets.push(book);
    }
  }

  // Layout major prophets (Former + Latter) normally
  for (const book of majorProphets) {
    const { width, height } = layoutBook(book, bookX, sectionY, globalVerseIdx, verses);
    maxHeight = Math.max(maxHeight, height);
    bookX += width + BOOK_GAP;
  }

  // Layout minor prophets with stacking
  const { height: minorHeight } = layoutMinorProphets(
    minorProphets,
    bookX,
    sectionY,
    globalVerseIdx,
    verses
  );
  maxHeight = Math.max(maxHeight, minorHeight);

  return maxHeight;
}

// Layout Ketuvim section (with special Psalms handling)
function layoutKetuvim(
  books: Book[],
  sectionY: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): number {
  let bookX = 0;
  let maxHeight = 0;

  for (const book of books) {
    let width: number, height: number;

    if (book.name === 'Psalms') {
      ({ width, height } = layoutPsalms(book, bookX, sectionY, globalVerseIdx, verses));
    } else {
      ({ width, height } = layoutBook(book, bookX, sectionY, globalVerseIdx, verses));
    }

    maxHeight = Math.max(maxHeight, height);
    bookX += width + BOOK_GAP;
  }

  return maxHeight;
}

// Layout Torah section (standard layout)
function layoutTorah(
  books: Book[],
  sectionY: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): number {
  let bookX = 0;
  let maxHeight = 0;

  for (const book of books) {
    const { width, height } = layoutBook(book, bookX, sectionY, globalVerseIdx, verses);
    maxHeight = Math.max(maxHeight, height);
    bookX += width + BOOK_GAP;
  }

  return maxHeight;
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
  const torahHeight = layoutTorah(torah, sectionY, globalVerseIdx, verses);
  sectionY += torahHeight + SECTION_GAP;

  // Nevi'im
  const neviimHeight = layoutNeviim(neviim, sectionY, globalVerseIdx, verses);
  sectionY += neviimHeight + SECTION_GAP;

  // Ketuvim
  layoutKetuvim(ketuvim, sectionY, globalVerseIdx, verses);

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
