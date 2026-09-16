import { describe, it, expect } from 'vitest';
import { MIN_ZOOM, MAX_ZOOM } from '../../camera';
import {
  advancePlacement,
  DEFAULT_SETTINGS,
  fontSizeForZoom,
  newPlacement,
  lineGridSnap,
  nearestVerseIndex,
  rangeToFill,
  pageTransform,
  passageAround,
  shouldRegenerate,
  stripMarks,
  windowAround,
} from '../../backgroundText';
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
      before: 'ב',
      center: 'ג',
      after: 'ד',
    });
  });

  it('shows only the center verse when content is center', () => {
    const settings = { ...DEFAULT_SETTINGS, content: 'center' as const, marks: 'all' as const };
    expect(passageAround(verses, texts, 1, settings)).toEqual({
      before: '',
      center: 'ב',
      after: '',
    });
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
