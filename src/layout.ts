// Layout algorithm: compute (x, y) position for every verse

import type { TorahData, LayoutConfig, TanakhLayout, Bounds, Book } from "./types.ts";
import { seededRandom } from "./utils/random.ts";
import { JITTER_CENTER, JITTER_RANGE } from "./constants/app.ts";

const VERSE_SIZE = 6; // pixels per verse square
const CHAPTER_GAP = 2; // gap between chapter rows
const BOOK_GAP = 12; // gap between book columns
const SECTION_GAP = 70; // gap between Torah/Nevi'im/Ketuvim sections
const STACKED_BOOK_GAP = 35; // gap between vertically stacked books
const WRAP_THRESHOLD = 50; // wrap chapters longer than this
const WRAP_INDENT = 12; // indent for wrapped lines (2 verse widths)
const MIN_WRAP_VERSES = 3; // minimum verses on a wrapped line (avoid widows)
const PSALMS_COLUMN_GAP = 15; // gap between Psalms columns

// Re-export for tests
export { seededRandom } from "./utils/random.ts";
export { getBookSection as getSection } from "./constants/books.ts";

// Calculate wrap points for a chapter, avoiding widow lines (< MIN_WRAP_VERSES)
function calculateWrapPoints(verseCount: number): number[] {
  if (verseCount === 0) {
    return [0];
  }

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
      const jitterX =
        (seededRandom(globalVerseIdx.value * 2) - JITTER_CENTER) * JITTER_RANGE;
      const jitterY =
        (seededRandom(globalVerseIdx.value * 2 + 1) - JITTER_CENTER) *
        JITTER_RANGE;

      const x = bookX + lineIndent + lineVerseIdx * VERSE_SIZE + jitterX;

      verses.push({
        book: bookName,
        chapter: chapterIdx + 1,
        verse: verseIdx + 1,
        x: x,
        y: currentY + jitterY,
        size: VERSE_SIZE,
      });

      maxWidth = Math.max(
        maxWidth,
        lineIndent + (lineVerseIdx + 1) * VERSE_SIZE,
      );
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

// Layout a single book and return its dimensions
function layoutBook(
  book: Book,
  bookX: number,
  bookY: number,
  globalVerseIdx: { value: number },
  verses: TanakhLayout[],
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
      verses,
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
    const { width, height } = bookLayoutFn(
      book,
      currentX,
      y,
      globalVerseIdx,
      verses,
    );
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
): { width: number; height: number } {
  let currentY = startY;
  let maxWidth = 0;

  for (const bookName of bookNames) {
    const book = bookMap.get(bookName);
    if (!book) {
      console.error(`Book not found in map: ${bookName}`);
      continue;
    }

    const { width, height } = layoutBook(
      book,
      x,
      currentY,
      globalVerseIdx,
      verses,
    );
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
      verses,
    );
    colAWidth = Math.max(colAWidth, width);
    colAY += height;
  }
  const colAHeight = colAY - bookY;

  // Column B: chapters 73-150
  const colBX = bookX + colAWidth + PSALMS_COLUMN_GAP;
  let colBY = bookY;
  let colBWidth = 0;
  for (
    let chapterIdx = splitPoint;
    chapterIdx < book.chapters.length;
    chapterIdx++
  ) {
    const verseCount = book.chapters[chapterIdx];
    const { width, height } = layoutChapter(
      book.name,
      chapterIdx,
      verseCount,
      colBX,
      colBY,
      globalVerseIdx,
      verses,
    );
    colBWidth = Math.max(colBWidth, width);
    colBY += height;
  }
  const colBHeight = colBY - bookY;

  return {
    width: colAWidth + PSALMS_COLUMN_GAP + colBWidth,
    height: Math.max(colAHeight, colBHeight),
  };
}

// Layout Nevi'im section (Former Prophets + Latter Prophets + stacked Minor Prophets)
function layoutNeviim(
  books: Book[],
  sectionY: number,
  globalVerseIdx: { value: number },
  verses: TanakhLayout[],
  minorProphetStacks: string[][],
): number {
  const minorProphets = new Set(minorProphetStacks.flat());

  // Separate major prophets from minor prophets
  const majorBooks = books.filter((b) => !minorProphets.has(b.name));
  const minorBooks = books.filter((b) => minorProphets.has(b.name));
  const minorProphetMap = new Map(minorBooks.map((b) => [b.name, b]));

  // Layout major prophets (Former + Latter) horizontally
  const { height: majorHeight, nextX } = layoutBooksRow(
    majorBooks,
    0,
    sectionY,
    BOOK_GAP,
    globalVerseIdx,
    verses,
  );

  // Layout minor prophets as stacked columns
  const { height: minorHeight } = layoutStacksRow(
    minorProphetStacks,
    minorProphetMap,
    nextX,
    sectionY,
    STACKED_BOOK_GAP,
    BOOK_GAP,
    globalVerseIdx,
    verses,
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
): number {
  const stackedBooks = new Set(layoutConfig.ketuvimStacks.flatMap((c) => c.books));
  const bookMap = new Map(books.map((b) => [b.name, b]));
  let bookX = 0;
  let maxHeight = 0;

  // Get regular (non-stacked) books
  const regularBooks = books.filter((b) => !stackedBooks.has(b.name));

  // Layout regular books, inserting stacks at appropriate positions
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
  const { height } = layoutBooksRow(
    books,
    0,
    sectionY,
    BOOK_GAP,
    globalVerseIdx,
    verses,
  );
  return height;
}

export function computeLayout(torahData: TorahData): TanakhLayout[] {
  if (torahData.books.length === 0) {
    console.warn("Empty books array in torahData");
    return [];
  }

  const verses: TanakhLayout[] = [];
  const globalVerseIdx = { value: 0 };

  // Group books by section
  const torah: Book[] = [];
  const neviim: Book[] = [];
  const ketuvim: Book[] = [];

  for (const book of torahData.books) {
    if (book.section === "torah") torah.push(book);
    else if (book.section === "neviim") neviim.push(book);
    else ketuvim.push(book);
  }

  // Layout each section vertically stacked
  let sectionY = 0;

  // Torah
  const torahHeight = layoutTorah(torah, sectionY, globalVerseIdx, verses);
  sectionY += torahHeight + SECTION_GAP;

  // Nevi'im
  const neviimHeight = layoutNeviim(neviim, sectionY, globalVerseIdx, verses, torahData.layout.minorProphetStacks);
  sectionY += neviimHeight + SECTION_GAP;

  // Ketuvim
  layoutKetuvim(ketuvim, sectionY, globalVerseIdx, verses, torahData.layout);

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
  if (verses.length === 0) return;

  let maxX = 0;
  for (const v of verses) {
    maxX = Math.max(maxX, v.x + v.size);
  }

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
