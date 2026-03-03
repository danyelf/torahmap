import { describe, it, expect } from 'vitest';
import {
  segmentToPixels,
  buildScrollSegmentMap,
  getScrollSectionHeight,
  SCROLL_CONSTANTS,
} from '../../scrollLayout';
import type { ScrollLayoutData, ScrollSegmentData } from '../../scrollLayout';

describe('scrollLayout', () => {
  describe('segmentToPixels', () => {
    it('places page 1 at rightmost position in first row (RTL)', () => {
      const { COLUMN_WIDTH, COLUMN_GAP, COLUMNS_PER_ROW } = SCROLL_CONSTANTS;
      const seg: ScrollSegmentData = {
        b: 1, c: 1, v: 1, p: 1, l: 0, s: 0, w: 1,
      };
      const pixel = segmentToPixels(seg, 0);
      // columnIndex=0, rowIndex=0, colInRow=19-0=19
      const expectedX = (COLUMNS_PER_ROW - 1) * (COLUMN_WIDTH + COLUMN_GAP);
      expect(pixel.x).toBe(expectedX);
      expect(pixel.y).toBe(0);
    });

    it('places page 20 at leftmost position in first row', () => {
      const seg: ScrollSegmentData = {
        b: 1, c: 10, v: 1, p: 20, l: 0, s: 0, w: 1,
      };
      const pixel = segmentToPixels(seg, 0);
      // columnIndex=19, rowIndex=0, colInRow=19-19=0
      expect(pixel.x).toBe(0);
      expect(pixel.y).toBe(0);
    });

    it('places page 21 in second row at rightmost position', () => {
      const { COLUMN_WIDTH, COLUMN_GAP, COLUMNS_PER_ROW, LINES_PER_PAGE, LINE_HEIGHT, ROW_GAP } = SCROLL_CONSTANTS;
      const seg: ScrollSegmentData = {
        b: 2, c: 1, v: 1, p: 21, l: 0, s: 0, w: 1,
      };
      const pixel = segmentToPixels(seg, 0);
      // columnIndex=20, rowIndex=1, colInRow=19-0=19
      const expectedX = (COLUMNS_PER_ROW - 1) * (COLUMN_WIDTH + COLUMN_GAP);
      const expectedY = 1 * (LINES_PER_PAGE * LINE_HEIGHT + ROW_GAP);
      expect(pixel.x).toBe(expectedX);
      expect(pixel.y).toBe(expectedY);
    });

    it('applies startFraction with RTL mirroring within column', () => {
      const { COLUMN_WIDTH, COLUMN_GAP, COLUMNS_PER_ROW } = SCROLL_CONSTANTS;
      const seg: ScrollSegmentData = {
        b: 1, c: 1, v: 2, p: 1, l: 2, s: 0.4, w: 0.6,
      };
      const pixel = segmentToPixels(seg, 0);
      const colX = (COLUMNS_PER_ROW - 1) * (COLUMN_WIDTH + COLUMN_GAP);
      // RTL: x = colX + (1 - 0.4 - 0.6) * CW = colX + 0
      expect(pixel.x).toBe(colX);
      expect(pixel.width).toBe(0.6 * COLUMN_WIDTH);
    });

    it('places start-of-line segment (s=0) at right edge of column', () => {
      const { COLUMN_WIDTH, COLUMN_GAP, COLUMNS_PER_ROW } = SCROLL_CONSTANTS;
      const seg: ScrollSegmentData = {
        b: 1, c: 1, v: 1, p: 1, l: 0, s: 0, w: 0.3,
      };
      const pixel = segmentToPixels(seg, 0);
      const colX = (COLUMNS_PER_ROW - 1) * (COLUMN_WIDTH + COLUMN_GAP);
      // RTL: s=0 (start of reading) maps to right side
      // x = colX + (1 - 0 - 0.3) * CW = colX + 0.7 * CW
      expect(pixel.x).toBe(colX + 0.7 * COLUMN_WIDTH);
    });

    it('applies scrollYOffset', () => {
      const seg: ScrollSegmentData = {
        b: 1, c: 1, v: 1, p: 1, l: 0, s: 0, w: 1,
      };
      const pixel = segmentToPixels(seg, 500);
      expect(pixel.y).toBe(500);
    });

    it('places different lines at correct y offsets', () => {
      const { LINE_HEIGHT } = SCROLL_CONSTANTS;
      const seg1: ScrollSegmentData = {
        b: 1, c: 1, v: 1, p: 1, l: 0, s: 0, w: 1,
      };
      const seg2: ScrollSegmentData = {
        b: 1, c: 1, v: 3, p: 1, l: 5, s: 0, w: 1,
      };
      const p1 = segmentToPixels(seg1, 0);
      const p2 = segmentToPixels(seg2, 0);
      expect(p2.y - p1.y).toBe(5 * LINE_HEIGHT);
    });

    it('height is always LINE_HEIGHT', () => {
      const { LINE_HEIGHT } = SCROLL_CONSTANTS;
      const seg: ScrollSegmentData = {
        b: 1, c: 1, v: 1, p: 1, l: 0, s: 0, w: 0.3,
      };
      const pixel = segmentToPixels(seg, 0);
      expect(pixel.height).toBe(LINE_HEIGHT);
    });
  });

  describe('buildScrollSegmentMap', () => {
    it('groups segments by verse key', () => {
      const data: ScrollLayoutData = {
        pages: 1,
        linesPerPage: [42],
        segments: [
          { b: 1, c: 1, v: 1, p: 1, l: 0, s: 0, w: 1 },
          { b: 1, c: 1, v: 1, p: 1, l: 1, s: 0, w: 0.5 },
          { b: 1, c: 1, v: 2, p: 1, l: 1, s: 0.5, w: 0.5 },
        ],
      };
      const map = buildScrollSegmentMap(data);
      expect(map.get('Genesis:1:1')!.length).toBe(2);
      expect(map.get('Genesis:1:2')!.length).toBe(1);
    });

    it('maps all five Torah books correctly', () => {
      const data: ScrollLayoutData = {
        pages: 5,
        linesPerPage: [42, 42, 42, 42, 42],
        segments: [
          { b: 1, c: 1, v: 1, p: 1, l: 0, s: 0, w: 1 },
          { b: 2, c: 1, v: 1, p: 2, l: 0, s: 0, w: 1 },
          { b: 3, c: 1, v: 1, p: 3, l: 0, s: 0, w: 1 },
          { b: 4, c: 1, v: 1, p: 4, l: 0, s: 0, w: 1 },
          { b: 5, c: 1, v: 1, p: 5, l: 0, s: 0, w: 1 },
        ],
      };
      const map = buildScrollSegmentMap(data);
      expect(map.has('Genesis:1:1')).toBe(true);
      expect(map.has('Exodus:1:1')).toBe(true);
      expect(map.has('Leviticus:1:1')).toBe(true);
      expect(map.has('Numbers:1:1')).toBe(true);
      expect(map.has('Deuteronomy:1:1')).toBe(true);
    });

    it('ignores segments with unknown book numbers', () => {
      const data: ScrollLayoutData = {
        pages: 1,
        linesPerPage: [42],
        segments: [
          { b: 6, c: 1, v: 1, p: 1, l: 0, s: 0, w: 1 },
        ],
      };
      const map = buildScrollSegmentMap(data);
      expect(map.size).toBe(0);
    });

    it('applies scrollYOffset to all segments', () => {
      const data: ScrollLayoutData = {
        pages: 1,
        linesPerPage: [42],
        segments: [
          { b: 1, c: 1, v: 1, p: 1, l: 0, s: 0, w: 1 },
        ],
      };
      const map = buildScrollSegmentMap(data, 100);
      const segments = map.get('Genesis:1:1')!;
      expect(segments[0].y).toBe(100);
    });
  });

  describe('getScrollSectionHeight', () => {
    it('computes height for 245 pages', () => {
      const data: ScrollLayoutData = {
        pages: 245,
        linesPerPage: Array(245).fill(42),
        segments: [],
      };
      const height = getScrollSectionHeight(data);
      const { LINE_HEIGHT, ROW_GAP, COLUMNS_PER_ROW, LINES_PER_PAGE } = SCROLL_CONSTANTS;
      const totalRows = Math.ceil(245 / COLUMNS_PER_ROW);
      expect(height).toBe(totalRows * (LINES_PER_PAGE * LINE_HEIGHT + ROW_GAP) - ROW_GAP);
    });

    it('computes height for single page', () => {
      const data: ScrollLayoutData = {
        pages: 1,
        linesPerPage: [42],
        segments: [],
      };
      const height = getScrollSectionHeight(data);
      const { LINE_HEIGHT, LINES_PER_PAGE } = SCROLL_CONSTANTS;
      expect(height).toBe(LINES_PER_PAGE * LINE_HEIGHT);
    });

    it('computes height for exactly one full row', () => {
      const data: ScrollLayoutData = {
        pages: 20,
        linesPerPage: Array(20).fill(42),
        segments: [],
      };
      const height = getScrollSectionHeight(data);
      const { LINE_HEIGHT, LINES_PER_PAGE } = SCROLL_CONSTANTS;
      // One row, no ROW_GAP subtracted
      expect(height).toBe(LINES_PER_PAGE * LINE_HEIGHT);
    });
  });
});
