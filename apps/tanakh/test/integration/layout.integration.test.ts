import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { computeLayout, getLayoutBounds } from '../../src/layout';
import { getBookSection as getSection, initBookData } from '../../src/books';
import type { TorahData, TanakhLayout } from '../../src/types';

describe('Layout Integration', () => {
  let torahData: TorahData;
  let verses: TanakhLayout[];

  beforeAll(() => {
    // Load the real tanakh structure data
    const dataPath = join(__dirname, '../../../../public/data/tanakh-structure.json');
    torahData = JSON.parse(readFileSync(dataPath, 'utf-8'));
    initBookData(torahData);
    verses = computeLayout(torahData);
  });

  describe('Verse Count', () => {
    it('produces exactly 23,206 verses (Sefaria Tanakh total)', () => {
      expect(verses.length).toBe(23206);
    });

    it('total verses matches sum from structure data', () => {
      const expectedTotal = torahData.books.reduce(
        (sum, book) => sum + book.chapters.reduce((s, c) => s + c, 0),
        0,
      );
      expect(verses.length).toBe(expectedTotal);
    });
  });

  describe('Determinism', () => {
    it('produces identical output on multiple runs', () => {
      const verses2 = computeLayout(torahData);

      expect(verses2.length).toBe(verses.length);

      // Check that positions are identical
      for (let i = 0; i < verses.length; i++) {
        expect(verses2[i].x).toBe(verses[i].x);
        expect(verses2[i].y).toBe(verses[i].y);
        expect(verses2[i].book).toBe(verses[i].book);
        expect(verses2[i].chapter).toBe(verses[i].chapter);
        expect(verses2[i].verse).toBe(verses[i].verse);
      }
    });
  });

  describe('Section Ordering', () => {
    it("Torah appears before Nevi'im", () => {
      const torahVerses = verses.filter((v) => getSection(v.book) === 'torah');
      const neviimVerses = verses.filter((v) => getSection(v.book) === 'neviim');

      const maxTorahY = Math.max(...torahVerses.map((v) => v.y));
      const minNeviimY = Math.min(...neviimVerses.map((v) => v.y));

      expect(maxTorahY).toBeLessThan(minNeviimY);
    });

    it("Nevi'im appears before Ketuvim", () => {
      const neviimVerses = verses.filter((v) => getSection(v.book) === 'neviim');
      const ketuvimVerses = verses.filter((v) => getSection(v.book) === 'ketuvim');

      const maxNeviimY = Math.max(...neviimVerses.map((v) => v.y));
      const minKetuvimY = Math.min(...ketuvimVerses.map((v) => v.y));

      expect(maxNeviimY).toBeLessThan(minKetuvimY);
    });
  });

  describe('Book Structure', () => {
    it('contains all 5 Torah books', () => {
      const torahBooks = new Set(
        verses.filter((v) => getSection(v.book) === 'torah').map((v) => v.book),
      );
      expect(torahBooks).toEqual(
        new Set(['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy']),
      );
    });

    it('contains all 39 books', () => {
      const allBooks = new Set(verses.map((v) => v.book));
      expect(allBooks.size).toBe(39);
    });
  });

  describe('No Overlapping Positions', () => {
    it('no two verses share a place', () => {
      expect(new Set(verses.map((v) => `${v.x},${v.y}`)).size).toBe(verses.length);
    });

    it("puts a line's verses side by side, a square apart", () => {
      const genesis1 = verses.filter((v) => v.book === 'Genesis' && v.chapter === 1);
      expect(new Set(genesis1.map((v) => v.y)).size).toBe(1);
      const xs = genesis1.map((v) => v.x);
      expect(xs.slice(1).map((x, i) => Math.abs(x - xs[i]))).toEqual(
        xs.slice(1).map(() => genesis1[0].size),
      );
    });

    it('nudges each verse by its own jitter, at most one unit each way', () => {
      const reach = Math.max(
        ...verses.flatMap((v) => [Math.abs(v.jitter!.x), Math.abs(v.jitter!.y)]),
      );
      expect(reach).toBeLessThanOrEqual(1);
      expect(new Set(verses.map((v) => v.jitter!.x)).size).toBeGreaterThan(1);
    });
  });

  describe('Psalm 119 Handling', () => {
    it('Psalm 119 (176 verses) wraps to multiple lines', () => {
      const psalm119Verses = verses.filter((v) => v.book === 'Psalms' && v.chapter === 119);

      expect(psalm119Verses.length).toBe(176);

      // Check that verses span multiple Y positions
      const uniqueYs = new Set(psalm119Verses.map((v) => Math.round(v.y)));
      expect(uniqueYs.size).toBeGreaterThan(1);
    });
  });

  describe('Layout Bounds', () => {
    it('bounds are positive and reasonable', () => {
      const bounds = getLayoutBounds(verses);

      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);

      // Reasonable upper bounds (not too large)
      expect(bounds.width).toBeLessThan(5000);
      expect(bounds.height).toBeLessThan(5000);
    });
  });

  describe('Verse Properties', () => {
    it('all verses have required properties', () => {
      for (const v of verses) {
        expect(v.book).toBeDefined();
        expect(v.chapter).toBeGreaterThan(0);
        expect(v.verse).toBeGreaterThan(0);
        expect(typeof v.x).toBe('number');
        expect(typeof v.y).toBe('number');
        expect(v.size).toBeGreaterThan(0);
      }
    });

    it('verses have no color property (colors computed separately)', () => {
      for (const v of verses) {
        // @ts-expect-error - checking that color property doesn't exist
        expect(v.color).toBeUndefined();
      }
    });
  });
});
