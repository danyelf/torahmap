// Layout algorithm: compute (x, y) position for every verse

import type { TorahData, LayoutConfig, TanakhLayout, Bounds, Book } from './types.ts';
import { verseId } from '@torahmap/link';
import { seededRandom } from './utils/random.ts';
import { JITTER_CENTER, JITTER_RANGE } from './constants.ts';

const VERSE_SIZE = 6; // pixels per verse square
const CHAPTER_GAP = 2; // gap between chapter rows
const BOOK_GAP = 12; // gap between book columns
const SECTION_GAP = 70; // gap between Torah/Nevi'im/Ketuvim sections
const STACKED_BOOK_GAP = 35; // gap between vertically stacked books
const WRAP_THRESHOLD = 50; // wrap chapters longer than this
const WRAP_INDENT = 12; // indent for wrapped lines (2 verse widths)
const MIN_WRAP_VERSES = 3; // minimum verses on a wrapped line (avoid widows)
const PSALMS_COLUMN_GAP = 15; // gap between Psalms columns

// Calculate wrap points for a chapter, avoiding widow lines (< MIN_WRAP_VERSES)
function calculateWrapPoints(verseCount: number): number[] {
  if (verseCount === 0) {
    return [0];
  }

  if (verseCount <= WRAP_THRESHOLD) {
    return [verseCount];
  }

  const lines: number[] = [];
  let remaining = verseCount;

  while (remaining > 0) {
    if (remaining <= WRAP_THRESHOLD) {
      lines.push(remaining);
      remaining = 0;
    } else if (remaining <= WRAP_THRESHOLD + MIN_WRAP_VERSES - 1) {
      // Would create a widow on next line - split more evenly instead
      // (e.g. 52 verses: 49+3 rather than 50+2)
      const firstLine = remaining - MIN_WRAP_VERSES;
      lines.push(firstLine);
      remaining -= firstLine;
    } else {
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
  verses: TanakhLayout[],
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
      const jitterX = (seededRandom(globalVerseIdx.value * 2) - JITTER_CENTER) * JITTER_RANGE;
      const jitterY = (seededRandom(globalVerseIdx.value * 2 + 1) - JITTER_CENTER) * JITTER_RANGE;

      const x = bookX + lineIndent + lineVerseIdx * VERSE_SIZE + jitterX;

      verses.push({
        // A verse's id is its link form, so a link names it directly.
        id: verseId(bookName, chapterIdx + 1, verseIdx + 1),
        book: bookName,
        chapter: chapterIdx + 1,
        verse: verseIdx + 1,
        x: x,
        y: currentY + jitterY,
        size: VERSE_SIZE,
      });

      maxWidth = Math.max(maxWidth, lineIndent + (lineVerseIdx + 1) * VERSE_SIZE);
      verseIdx++;
      globalVerseIdx.value++;
    }

    currentY += VERSE_SIZE + CHAPTER_GAP;
  }

  return {
    width: maxWidth,
    height: wrapPoints.length * (VERSE_SIZE + CHAPTER_GAP),
  };
}

// Lay out chapters [from, to) of a book as one column and return its dimensions
function layoutChapters(
  book: Book,
  from: number,
  to: number,
  x: number,
  y: number,
  globalVerseIdx: { value: number },
  verses: TanakhLayout[],
): { width: number; height: number } {
  let maxWidth = 0;
  let currentY = y;

  for (let chapterIdx = from; chapterIdx < to; chapterIdx++) {
    const { width, height } = layoutChapter(
      book.name,
      chapterIdx,
      book.chapters[chapterIdx],
      x,
      currentY,
      globalVerseIdx,
      verses,
    );
    maxWidth = Math.max(maxWidth, width);
    currentY += height;
  }

  return { width: maxWidth, height: currentY - y };
}

function layoutBook(
  book: Book,
  bookX: number,
  bookY: number,
  globalVerseIdx: { value: number },
  verses: TanakhLayout[],
): { width: number; height: number } {
  return layoutChapters(book, 0, book.chapters.length, bookX, bookY, globalVerseIdx, verses);
}

// Type for custom book layout functions (e.g., Psalms multi-column)
type BookLayoutFn = (
  book: Book,
  x: number,
  y: number,
  globalVerseIdx: { value: number },
  verses: TanakhLayout[],
) => { width: number; height: number };

// Layout books horizontally in a row
function layoutBooksRow(
  books: Book[],
  startX: number,
  y: number,
  gap: number,
  globalVerseIdx: { value: number },
  verses: TanakhLayout[],
  bookLayoutFn: BookLayoutFn = layoutBook,
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
    nextX: currentX,
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
  verses: TanakhLayout[],
  report: Report,
): { width: number; height: number } {
  let currentY = startY;
  let maxWidth = 0;

  for (const bookName of bookNames) {
    const book = bookMap.get(bookName);
    if (!book) {
      report(`Book not found in map: ${bookName}`);
      continue;
    }

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
  verses: TanakhLayout[],
  report: Report,
): { width: number; height: number } {
  let currentX = startX;
  let maxHeight = 0;

  for (const stack of stacks) {
    const { width, height } = layoutBooksStack(
      stack,
      bookMap,
      currentX,
      y,
      stackGap,
      globalVerseIdx,
      verses,
      report,
    );
    maxHeight = Math.max(maxHeight, height);
    currentX += width + columnGap;
  }

  return {
    width: currentX - startX - (stacks.length > 0 ? columnGap : 0),
    height: maxHeight,
  };
}

// Layout a book in two columns, split at a given chapter
function layoutMultiColumn(
  book: Book,
  bookX: number,
  bookY: number,
  globalVerseIdx: { value: number },
  verses: TanakhLayout[],
  splitAtChapter: number,
): { width: number; height: number } {
  const splitPoint = Math.min(splitAtChapter, book.chapters.length);
  const end = book.chapters.length;
  const colA = layoutChapters(book, 0, splitPoint, bookX, bookY, globalVerseIdx, verses);
  const colBX = bookX + colA.width + PSALMS_COLUMN_GAP;
  const colB = layoutChapters(book, splitPoint, end, colBX, bookY, globalVerseIdx, verses);

  return {
    width: colA.width + PSALMS_COLUMN_GAP + colB.width,
    height: Math.max(colA.height, colB.height),
  };
}

// Layout Nevi'im section (Former Prophets + Latter Prophets + stacked Minor Prophets)
function layoutNeviim(
  books: Book[],
  sectionY: number,
  globalVerseIdx: { value: number },
  verses: TanakhLayout[],
  minorProphetStacks: string[][],
  report: Report,
): number {
  const minorProphets = new Set(minorProphetStacks.flat());

  const majorBooks = books.filter((b) => !minorProphets.has(b.name));
  const minorBooks = books.filter((b) => minorProphets.has(b.name));
  const minorProphetMap = new Map(minorBooks.map((b) => [b.name, b]));

  const { height: majorHeight, nextX } = layoutBooksRow(
    majorBooks,
    0,
    sectionY,
    BOOK_GAP,
    globalVerseIdx,
    verses,
  );

  const { height: minorHeight } = layoutStacksRow(
    minorProphetStacks,
    minorProphetMap,
    nextX,
    sectionY,
    STACKED_BOOK_GAP,
    BOOK_GAP,
    globalVerseIdx,
    verses,
    report,
  );

  return Math.max(majorHeight, minorHeight);
}

// Layout Ketuvim section (with special Psalms and stacking handling)
function layoutKetuvim(
  books: Book[],
  sectionY: number,
  globalVerseIdx: { value: number },
  verses: TanakhLayout[],
  layoutConfig: LayoutConfig,
  report: Report,
): number {
  const stackedBooks = new Set(layoutConfig.ketuvimStacks.flatMap((c) => c.books));
  const bookMap = new Map(books.map((b) => [b.name, b]));
  let bookX = 0;
  let maxHeight = 0;

  const regularBooks = books.filter((b) => !stackedBooks.has(b.name));

  for (const book of regularBooks) {
    const multiCol = layoutConfig.multiColumnBooks?.[book.name];
    const { width, height } = multiCol
      ? layoutMultiColumn(book, bookX, sectionY, globalVerseIdx, verses, multiCol.splitAtChapter)
      : layoutBook(book, bookX, sectionY, globalVerseIdx, verses);

    maxHeight = Math.max(maxHeight, height);
    bookX += width + BOOK_GAP;

    // Insert any stacks configured to appear after this book
    for (const config of layoutConfig.ketuvimStacks) {
      if (book.name === config.insertAfter) {
        const { width: stackWidth, height: stackHeight } = layoutBooksStack(
          config.books,
          bookMap,
          bookX,
          sectionY,
          STACKED_BOOK_GAP,
          globalVerseIdx,
          verses,
          report,
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
  verses: TanakhLayout[],
): number {
  const { height } = layoutBooksRow(books, 0, sectionY, BOOK_GAP, globalVerseIdx, verses);
  return height;
}

type Report = (message: string) => void;

export function computeLayout(
  torahData: TorahData,
  report: Report = console.error,
): TanakhLayout[] {
  if (torahData.books.length === 0) {
    console.warn('Empty books array in torahData');
    return [];
  }

  const verses: TanakhLayout[] = [];
  const globalVerseIdx = { value: 0 };

  const torah: Book[] = [];
  const neviim: Book[] = [];
  const ketuvim: Book[] = [];

  for (const book of torahData.books) {
    if (book.section === 'torah') torah.push(book);
    else if (book.section === 'neviim') neviim.push(book);
    else ketuvim.push(book);
  }

  // Sections stack vertically: Torah, then Nevi'im, then Ketuvim.
  let sectionY = 0;

  const torahHeight = layoutTorah(torah, sectionY, globalVerseIdx, verses);
  sectionY += torahHeight + SECTION_GAP;

  const neviimHeight = layoutNeviim(
    neviim,
    sectionY,
    globalVerseIdx,
    verses,
    torahData.layout.minorProphetStacks,
    report,
  );
  sectionY += neviimHeight + SECTION_GAP;

  layoutKetuvim(ketuvim, sectionY, globalVerseIdx, verses, torahData.layout, report);

  // Mirror x-coordinates for RTL layout: Genesis rightmost, verse 1 at right
  // edge of each row, ragged chapter endings on the left.
  mirrorX(verses);

  return verses;
}

/**
 * Mirror all verse x-coordinates so the layout reads right-to-left.
 * Transforms x → (maxX - x - size) so the rightmost extent stays the same
 * but everything is horizontally flipped.
 */
function mirrorX(verses: TanakhLayout[]): void {
  const maxX = getLayoutBounds(verses).width;
  for (const v of verses) {
    v.x = maxX - v.x - v.size;
  }
}

export function getLayoutBounds(verses: TanakhLayout[]): Bounds {
  if (verses.length === 0) {
    return { width: 0, height: 0 };
  }

  let maxX = 0,
    maxY = 0;
  for (const v of verses) {
    maxX = Math.max(maxX, v.x + v.size);
    maxY = Math.max(maxY, v.y + v.size);
  }

  return { width: maxX, height: maxY };
}
