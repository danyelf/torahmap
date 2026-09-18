import { describe, it, expect } from 'vitest';
import { MIN_ZOOM, MAX_ZOOM } from '../../camera';
import {
  advancePlacement,
  bookBoxes,
  DEFAULT_SETTINGS,
  dominantUnitStart,
  fontSizeForZoom,
  growBoxes,
  rangeFromStart,
  newPlacement,
  lineGridSnap,
  nearestVerseIndex,
  rangeToFill,
  pageTransform,
  passageAround,
  planeTransform,
  shouldRegenerate,
  stripMarks,
  windowAround,
} from '../../backgroundText/model';
import type { TanakhLayout } from '../../types';
import type { VerseTexts } from '../../verseTexts';

const verses: TanakhLayout[] = [
  { book: 'Genesis', chapter: 50, verse: 25, x: 12, y: 0, size: 6 },
  { book: 'Genesis', chapter: 50, verse: 26, x: 6, y: 0, size: 6 },
  { book: 'Exodus', chapter: 1, verse: 1, x: 100, y: 0, size: 6 },
  { book: 'Exodus', chapter: 1, verse: 2, x: 94, y: 0, size: 6 },
];

const texts: VerseTexts = {
  Genesis: { '50': { '25': { he: 'א', en: '' }, '26': { he: 'ב', en: '' } } },
  Exodus: { '1': { '1': { he: 'ג', en: '' }, '2': { he: 'ד', en: '' } } },
};

describe('fontSizeForZoom', () => {
  it('hits the endpoints at the zoom limits and grows on a log scale between', () => {
    expect(fontSizeForZoom(MIN_ZOOM, 12, 24)).toBeCloseTo(12);
    expect(fontSizeForZoom(MAX_ZOOM, 12, 24)).toBeCloseTo(24);
    // Zoom 1 is halfway across the log range, so the font is 12 * sqrt(2).
    expect(fontSizeForZoom(1, 12, 24)).toBeCloseTo(12 * Math.SQRT2);
  });
});

describe('nearestVerseIndex', () => {
  it('picks the square whose center is closest to the world point', () => {
    expect(nearestVerseIndex(verses, 101, 4)).toBe(2);
    expect(nearestVerseIndex(verses, 8, 1)).toBe(1);
  });
});

describe('windowAround', () => {
  it('clamps at both ends of the corpus', () => {
    expect(windowAround(0, 4, 2)).toEqual({ start: 0, end: 2 });
    expect(windowAround(3, 4, 2)).toEqual({ start: 1, end: 3 });
  });
});

describe('passageAround', () => {
  it('runs across a book boundary in canonical order', () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      content: 'window' as const,
      neighbours: 1,
      marks: 'all' as const,
    };
    expect(passageAround(verses, texts, 2, settings)).toEqual({
      start: 1,
      verses: ['ב', 'ג', 'ד'],
    });
  });

  it('shows only the center verse when content is center', () => {
    const settings = { ...DEFAULT_SETTINGS, content: 'center' as const, marks: 'all' as const };
    expect(passageAround(verses, texts, 1, settings)).toEqual({ start: 1, verses: ['ב'] });
  });
});

describe('dominantUnitStart', () => {
  it('picks the book with the most squares in view and returns its first verse', () => {
    // Exodus 1:1 and 1:2 are in view, Genesis 50:25 only.
    const rect = { left: 10, top: -1, right: 110, bottom: 10 };
    expect(dominantUnitStart(verses, rect, 'book')).toBe(2);
  });

  it('is null when nothing is in view', () => {
    const rect = { left: 500, top: 500, right: 600, bottom: 600 };
    expect(dominantUnitStart(verses, rect, 'book')).toBeNull();
  });
});

describe('bookBoxes', () => {
  it('bounds each book and records its first and last verse', () => {
    expect(bookBoxes(verses)).toEqual([
      { book: 'Genesis', first: 0, last: 1, left: 6, top: 0, right: 18, bottom: 6 },
      { book: 'Exodus', first: 2, last: 3, left: 94, top: 0, right: 106, bottom: 6 },
    ]);
  });
});

describe('growBoxes', () => {
  const box = (book: string, left: number, top: number, right: number, bottom: number) => ({
    book,
    first: 0,
    last: 0,
    left,
    top,
    right,
    bottom,
  });

  it('grows down to the row below and left to the neighbour, without overlap', () => {
    // A row of two books with a gap between them, and a wide book below.
    const grown = growBoxes([
      box('A', 60, 0, 100, 10),
      box('B', 0, 0, 40, 20),
      box('C', 0, 50, 100, 60),
    ]);
    expect(grown.map((b) => [b.book, b.left, b.top, b.right, b.bottom])).toEqual([
      ['A', 40, 0, 100, 50],
      ['B', 0, 0, 40, 50],
      ['C', 0, 50, 100, 60],
    ]);
  });
});

describe('planeTransform', () => {
  const camera = { x: 0, y: 0, zoom: 2 };
  const origin = { x: 100, y: 100 };

  it('at size 1 leaves the point under the origin where it is', () => {
    // Map point (50, 50) is at screen (100, 100) at zoom 2.
    const plane = { parallax: 0.5, size: 1, pivot: { x: 0, y: 0 } };
    expect(planeTransform(50, 50, camera, plane, origin)).toEqual({ x: 100, y: 100, scale: 1 });
  });

  it('moves by the parallax ratio of a pan, whatever its size', () => {
    const plane = { parallax: 0.25, size: 3, pivot: { x: 0, y: 0 } };
    const before = planeTransform(0, 0, camera, plane, origin);
    const after = planeTransform(0, 0, { ...camera, x: 20 }, plane, origin);
    // Panning 20 map units at zoom 2 moves the map 40 pixels; the plane moves 10.
    expect(after.x - before.x).toBeCloseTo(10);
  });

  it('at size 1/parallax lines up with the map at the pivot', () => {
    // The pivot (50, 50) is under the origin, as is its point on the plane.
    const plane = { parallax: 0.25, size: 4, pivot: { x: 50, y: 50 } };
    const t = planeTransform(50, 50, camera, plane, origin);
    expect([t.x, t.y]).toEqual([100, 100]);
    // A map point 10 units away lands 10 map units away on screen, as on the map.
    expect(planeTransform(60, 50, camera, plane, origin).x).toBeCloseTo(120);
  });
});

describe('rangeFromStart', () => {
  it('grows forward only, until the text is long enough', () => {
    // Each verse is one letter plus a separator: two characters.
    expect(rangeFromStart(verses, texts, 1, 3)).toEqual({ start: 1, end: 2 });
    expect(rangeFromStart(verses, texts, 2, 100)).toEqual({ start: 2, end: 3 });
  });
});

describe('shouldRegenerate', () => {
  it('always builds the first time, then only past the hysteresis', () => {
    expect(shouldRegenerate(null, 5, 3)).toBe(true);
    expect(shouldRegenerate(5, 8, 3)).toBe(false);
    expect(shouldRegenerate(5, 9, 3)).toBe(true);
  });
});

describe('stripMarks', () => {
  // bet + sheva + etnahta + resh: U+05D1 U+05B0 U+0591 U+05E8
  const word = 'בְ֑ר';
  it('keeps everything, drops trop, or drops trop and nikkud', () => {
    expect(stripMarks(word, 'all')).toBe(word);
    expect(stripMarks(word, 'no-trop')).toBe('בְר');
    expect(stripMarks(word, 'letters')).toBe('בר');
  });
});

describe('pageTransform', () => {
  const built = () => newPlacement({ x: 100, y: 50 }, { x: 300, y: 200 }, { x: 40, y: 10 }, 1);

  it('puts the reference point on the anchor at build time', () => {
    expect(pageTransform(built(), 0.3, 0, 1)).toEqual({ x: 260, y: 190 });
  });

  it('follows a pan by the parallax ratio', () => {
    // Same zoom, camera panned so the anchor moved by (+50, +60).
    const moved = advancePlacement(built(), { x: 250, y: 210, zoom: 1 }, false);
    expect(pageTransform(moved, 1, 0, 1)).toEqual({ x: 310, y: 250 });
    expect(pageTransform(moved, 0.5, 0, 1)).toEqual({ x: 285, y: 220 });
    expect(pageTransform(moved, 0, 0, 1)).toEqual({ x: 260, y: 190 });
  });

  it('follows a zoom only by the zoom-follow ratio', () => {
    // Zoom doubled: the anchor is now at (400, 300), a move of (+100, +100).
    const zoomed = advancePlacement(built(), { x: 100, y: 100, zoom: 2 }, true);
    expect(pageTransform(zoomed, 0.3, 1, 1)).toEqual({ x: 360, y: 290 });
    expect(pageTransform(zoomed, 0.3, 0, 1)).toEqual({ x: 260, y: 190 });
  });

  it('scales the reference offset with the page scale', () => {
    expect(pageTransform(built(), 1, 1, 2)).toEqual({ x: 220, y: 180 });
  });
});

describe('rangeToFill', () => {
  it('grows on alternating sides until the text is long enough, and stops at the corpus', () => {
    // Each verse is one letter plus a space: two characters.
    expect(rangeToFill(verses, texts, 2, 1)).toEqual({ start: 2, end: 2 });
    expect(rangeToFill(verses, texts, 2, 3)).toEqual({ start: 1, end: 2 });
    expect(rangeToFill(verses, texts, 2, 5)).toEqual({ start: 1, end: 3 });
    expect(rangeToFill(verses, texts, 2, 100)).toEqual({ start: 0, end: 3 });
  });
});

describe('lineGridSnap', () => {
  it('returns the smallest shift that aligns the line grids', () => {
    expect(lineGridSnap(100, 100, 25)).toBe(0);
    expect(lineGridSnap(100, 90, 25)).toBe(10);
    expect(lineGridSnap(100, 82, 25)).toBe(-7);
    expect(lineGridSnap(100, 350, 25)).toBe(0);
  });
});
