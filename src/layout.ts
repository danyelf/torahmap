// Layout algorithm: compute (x, y) position for every verse

import type { TorahData, Verse, Bounds, Book } from './types.ts';

const VERSE_SIZE = 6;           // pixels per verse square
const CHAPTER_GAP = 2;          // gap between chapter rows
const BOOK_GAP = 12;            // gap between book columns
const SECTION_GAP = 70;         // gap between Torah/Nevi'im/Ketuvim sections
const STACKED_BOOK_GAP = 35;    // gap between vertically stacked books
const WRAP_THRESHOLD = 50;      // wrap chapters longer than this
const WRAP_INDENT = 12;         // indent for wrapped lines (2 verse widths)
const MIN_WRAP_VERSES = 3;      // minimum verses on a wrapped line (avoid widows)
const PSALMS_COLUMN_GAP = 15;   // gap between Psalms columns

// Section definitions for Tanakh
const TORAH_BOOKS = new Set(['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']);
const KETUVIM_BOOKS = new Set([
  'Psalms', 'Proverbs', 'Job', 'Song of Songs', 'Ruth',
  'Lamentations', 'Ecclesiastes', 'Esther', 'Daniel',
  'Ezra', 'Nehemiah', 'I Chronicles', 'II Chronicles'
]);

// Minor prophets stacking: each array is a vertical stack (top to bottom)
// Balanced for similar heights: ~18, ~14, ~18, ~17 chapter rows
const MINOR_PROPHET_STACKS = [
  ['Hosea', 'Joel'],                                    // 14 + 4 = 18 chapters
  ['Amos', 'Obadiah', 'Jonah'],                         // 9 + 1 + 4 = 14 chapters
  ['Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai'], // 7 + 3 + 3 + 3 + 2 = 18 chapters
  ['Zechariah', 'Malachi']                              // 14 + 3 = 17 chapters
];

const MINOR_PROPHETS = new Set(MINOR_PROPHET_STACKS.flat());

// Ketuvim stacking: [stack, insertAfterBook]
// The Five Megillot (scrolls) are grouped into two stacks
const KETUVIM_STACK_CONFIG: Array<{ books: string[]; insertAfter: string }> = [
  { books: ['Song of Songs', 'Ruth', 'Lamentations'], insertAfter: 'Job' },      // 8 + 4 + 5 = 17 chapters
  { books: ['Ecclesiastes', 'Esther'], insertAfter: 'Job' },                      // 12 + 10 = 22 chapters
  { books: ['Ezra', 'Nehemiah'], insertAfter: 'Daniel' }                          // 10 + 13 = 23 chapters
];
const STACKED_KETUVIM = new Set(KETUVIM_STACK_CONFIG.flatMap(c => c.books));

export function getSection(bookName: string): 'torah' | 'neviim' | 'ketuvim' {
  if (TORAH_BOOKS.has(bookName)) return 'torah';
  if (KETUVIM_BOOKS.has(bookName)) return 'ketuvim';
  return 'neviim';
}

// Seeded random for deterministic jitter (same layout every time)
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Calculate wrap points for a chapter, avoiding widow lines (< MIN_WRAP_VERSES)
export function calculateWrapPoints(verseCount: number): number[] {
  if (verseCount <= WRAP_THRESHOLD) {
    return [verseCount]; // No wrapping needed
  }

  const lines: number[] = [];
  let remaining = verseCount;

  while (remaining > 0) {
    if (remaining <= WRAP_THRESHOLD) {
      // Last line - just take what's left
      lines.push(remaining);
      remaining = 0;
    } else if (remaining <= WRAP_THRESHOLD + MIN_WRAP_VERSES - 1) {
      // Would create a widow on next line - split more evenly
      // e.g., 52 verses: instead of 50+2, do 49+3 or split evenly
      const firstLine = remaining - MIN_WRAP_VERSES;
      lines.push(firstLine);
      remaining -= firstLine;
    } else {
      // Normal case - take full line
      lines.push(WRAP_THRESHOLD);
      remaining -= WRAP_THRESHOLD;
    }
  }

  return lines;
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
  const wrapPoints = calculateWrapPoints(verseCount);
  let maxWidth = 0;
  let currentY = chapterY;
  let verseIdx = 0;

  for (let lineNumber = 0; lineNumber < wrapPoints.length; lineNumber++) {
    const lineLength = wrapPoints[lineNumber];
    const lineIndent = lineNumber > 0 ? WRAP_INDENT : 0;

    for (let lineVerseIdx = 0; lineVerseIdx < lineLength; lineVerseIdx++) {
      // Position jitter (±1px) to break up regular grid
      const jitterX = (seededRandom(globalVerseIdx.value * 2) - 0.5) * 2.0;
      const jitterY = (seededRandom(globalVerseIdx.value * 2 + 1) - 0.5) * 2.0;

      // Wider brightness variation (0.4 to 0.8)
      const brightness = 0.4 + seededRandom(globalVerseIdx.value * 3) * 0.4;

      const x = bookX + lineIndent + lineVerseIdx * VERSE_SIZE + jitterX;

      verses.push({
        book: bookName,
        chapter: chapterIdx + 1,
        verse: verseIdx + 1,
        x: x,
        y: currentY + jitterY,
        size: VERSE_SIZE,
        color: [brightness, brightness, brightness]
      });

      maxWidth = Math.max(maxWidth, lineIndent + (lineVerseIdx + 1) * VERSE_SIZE);
      verseIdx++;
      globalVerseIdx.value++;
    }

    currentY += VERSE_SIZE + CHAPTER_GAP;
  }

  return { width: maxWidth, height: wrapPoints.length * (VERSE_SIZE + CHAPTER_GAP) };
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

// Type for custom book layout functions (e.g., Psalms multi-column)
type BookLayoutFn = (
  book: Book,
  x: number,
  y: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
) => { width: number; height: number };

// Layout books horizontally in a row
function layoutBooksRow(
  books: Book[],
  startX: number,
  y: number,
  gap: number,
  globalVerseIdx: { value: number },
  verses: Verse[],
  bookLayoutFn: BookLayoutFn = layoutBook
): { width: number; height: number; nextX: number } {
  let currentX = startX;
  let maxHeight = 0;

  for (const book of books) {
    const { width, height } = bookLayoutFn(book, currentX, y, globalVerseIdx, verses);
    maxHeight = Math.max(maxHeight, height);
    currentX += width + gap;
  }

  return {
    width: currentX - startX - (books.length > 0 ? gap : 0),
    height: maxHeight,
    nextX: currentX
  };
}

// Layout books vertically in a stack
function layoutBooksStack(
  bookNames: string[],
  bookMap: Map<string, Book>,
  x: number,
  startY: number,
  gap: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): { width: number; height: number } {
  let currentY = startY;
  let maxWidth = 0;

  for (const bookName of bookNames) {
    const book = bookMap.get(bookName);
    if (!book) continue;

    const { width, height } = layoutBook(book, x, currentY, globalVerseIdx, verses);
    maxWidth = Math.max(maxWidth, width);
    currentY += height + gap;
  }

  const totalHeight = currentY - startY - (bookNames.length > 0 ? gap : 0);
  return { width: maxWidth, height: totalHeight };
}

// Layout multiple stacks side by side (for minor prophets, etc.)
function layoutStacksRow(
  stacks: string[][],
  bookMap: Map<string, Book>,
  startX: number,
  y: number,
  stackGap: number,
  columnGap: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): { width: number; height: number } {
  let currentX = startX;
  let maxHeight = 0;

  for (const stack of stacks) {
    const { width, height } = layoutBooksStack(stack, bookMap, currentX, y, stackGap, globalVerseIdx, verses);
    maxHeight = Math.max(maxHeight, height);
    currentX += width + columnGap;
  }

  return {
    width: currentX - startX - (stacks.length > 0 ? columnGap : 0),
    height: maxHeight
  };
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

// Layout Nevi'im section (Former Prophets + Latter Prophets + stacked Minor Prophets)
function layoutNeviim(
  books: Book[],
  sectionY: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): number {
  // Separate major prophets from minor prophets
  const majorProphets = books.filter(b => !MINOR_PROPHETS.has(b.name));
  const minorProphets = books.filter(b => MINOR_PROPHETS.has(b.name));
  const minorProphetMap = new Map(minorProphets.map(b => [b.name, b]));

  // Layout major prophets (Former + Latter) horizontally
  const { height: majorHeight, nextX } = layoutBooksRow(
    majorProphets, 0, sectionY, BOOK_GAP, globalVerseIdx, verses
  );

  // Layout minor prophets as stacked columns
  const { height: minorHeight } = layoutStacksRow(
    MINOR_PROPHET_STACKS, minorProphetMap, nextX, sectionY,
    STACKED_BOOK_GAP, BOOK_GAP, globalVerseIdx, verses
  );

  return Math.max(majorHeight, minorHeight);
}

// Layout Ketuvim section (with special Psalms and stacking handling)
function layoutKetuvim(
  books: Book[],
  sectionY: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): number {
  const bookMap = new Map(books.map(b => [b.name, b]));
  let bookX = 0;
  let maxHeight = 0;

  // Get regular (non-stacked) books
  const regularBooks = books.filter(b => !STACKED_KETUVIM.has(b.name));

  // Layout regular books, inserting stacks at appropriate positions
  for (const book of regularBooks) {
    // Psalms uses special two-column layout
    const { width, height } = book.name === 'Psalms'
      ? layoutPsalms(book, bookX, sectionY, globalVerseIdx, verses)
      : layoutBook(book, bookX, sectionY, globalVerseIdx, verses);

    maxHeight = Math.max(maxHeight, height);
    bookX += width + BOOK_GAP;

    // Insert any stacks configured to appear after this book
    for (const config of KETUVIM_STACK_CONFIG) {
      if (book.name === config.insertAfter) {
        const { width: stackWidth, height: stackHeight } = layoutBooksStack(
          config.books, bookMap, bookX, sectionY, STACKED_BOOK_GAP, globalVerseIdx, verses
        );
        maxHeight = Math.max(maxHeight, stackHeight);
        bookX += stackWidth + BOOK_GAP;
      }
    }
  }

  return maxHeight;
}

// Layout Torah section (standard horizontal layout)
function layoutTorah(
  books: Book[],
  sectionY: number,
  globalVerseIdx: { value: number },
  verses: Verse[]
): number {
  const { height } = layoutBooksRow(books, 0, sectionY, BOOK_GAP, globalVerseIdx, verses);
  return height;
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
