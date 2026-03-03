// Scroll layout engine: converts tikkun.io data to pixel positions
// Columns flow right-to-left within rows, rows stack top-to-bottom

import type { LayoutSegment } from './types';

// Scroll layout constants
export const SCROLL_CONSTANTS = {
  COLUMN_WIDTH: 80,       // pixels per column (page)
  LINE_HEIGHT: 4,         // pixels per line
  COLUMN_GAP: 8,          // gap between columns
  ROW_GAP: 20,            // gap between rows of columns
  COLUMNS_PER_ROW: 20,    // columns per visual row
  LINES_PER_PAGE: 42,     // standard Torah scroll lines per column
} as const;

// Data format from scroll-layout.json (short keys for file size)
export interface ScrollSegmentData {
  b: number;    // book (1-5)
  c: number;    // chapter
  v: number;    // verse
  p: number;    // page (1-245)
  l: number;    // line (0-based)
  s: number;    // startFraction
  w: number;    // widthFraction
  f?: string;   // format: 'n'|'s'|'h' (default 'n', omitted in JSON)
  pe?: boolean; // isPetucha (default false, omitted in JSON)
}

export interface ScrollLayoutData {
  pages: number;
  linesPerPage: number[];
  segments: ScrollSegmentData[];
}

// Book number to name mapping (tikkun uses 1-5)
const BOOK_NAMES: Record<number, string> = {
  1: 'Genesis', 2: 'Exodus', 3: 'Leviticus', 4: 'Numbers', 5: 'Deuteronomy',
};

/**
 * Convert a scroll segment from the JSON data into pixel coordinates.
 * Columns flow right-to-left within rows, rows stack top-to-bottom.
 */
export function segmentToPixels(
  seg: ScrollSegmentData,
  scrollYOffset: number = 0
): LayoutSegment {
  const { COLUMN_WIDTH, LINE_HEIGHT, COLUMN_GAP, ROW_GAP, COLUMNS_PER_ROW, LINES_PER_PAGE } = SCROLL_CONSTANTS;

  const columnIndex = seg.p - 1; // 0-based
  const rowIndex = Math.floor(columnIndex / COLUMNS_PER_ROW);
  const colInRow = COLUMNS_PER_ROW - 1 - (columnIndex % COLUMNS_PER_ROW); // RTL

  const x = colInRow * (COLUMN_WIDTH + COLUMN_GAP) + seg.s * COLUMN_WIDTH;
  const y = scrollYOffset + rowIndex * (LINES_PER_PAGE * LINE_HEIGHT + ROW_GAP) + seg.l * LINE_HEIGHT;
  const width = seg.w * COLUMN_WIDTH;
  const height = LINE_HEIGHT;

  return { x, y, width, height };
}

/**
 * Build a map from "book:chapter:verse" to LayoutSegment[] for all Torah verses.
 */
export function buildScrollSegmentMap(
  data: ScrollLayoutData,
  scrollYOffset: number = 0
): Map<string, LayoutSegment[]> {
  const map = new Map<string, LayoutSegment[]>();

  for (const seg of data.segments) {
    const bookName = BOOK_NAMES[seg.b];
    if (!bookName) continue;

    const key = `${bookName}:${seg.c}:${seg.v}`;
    const pixel = segmentToPixels(seg, scrollYOffset);

    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(pixel);
  }

  return map;
}

/**
 * Compute the total height of the Torah scroll section in pixels.
 */
export function getScrollSectionHeight(data: ScrollLayoutData): number {
  const { LINE_HEIGHT, ROW_GAP, COLUMNS_PER_ROW, LINES_PER_PAGE } = SCROLL_CONSTANTS;
  const totalRows = Math.ceil(data.pages / COLUMNS_PER_ROW);
  return totalRows * (LINES_PER_PAGE * LINE_HEIGHT + ROW_GAP) - ROW_GAP;
}
