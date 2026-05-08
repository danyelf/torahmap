import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { computeLayout, getSection, getLayoutBounds } from '../../layout';
import { initBookData } from '../../constants/books';
import type { TorahData, TanakhLayout } from '../../types';

describe('Layout Integration', () => {
  let torahData: TorahData;
  let verses: TanakhLayout[];

  beforeAll(() => {
    // Load the real tanakh structure data
    const dataPath = join(__dirname, '../../../public/data/tanakh-structure.json');
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
        0
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
    it('Torah appears before Nevi\'im', () => {
      const torahVerses = verses.filter(v => getSection(v.book) === 'torah');
      const neviimVerses = verses.filter(v => getSection(v.book) === 'neviim');

      const maxTorahY = Math.max(...torahVerses.map(v => v.y));
      const minNeviimY = Math.min(...neviimVerses.map(v => v.y));

      expect(maxTorahY).toBeLessThan(minNeviimY);
    });

    it('Nevi\'im appears before Ketuvim', () => {
      const neviimVerses = verses.filter(v => getSection(v.book) === 'neviim');
      const ketuvimVerses = verses.filter(v => getSection(v.book) === 'ketuvim');

      const maxNeviimY = Math.max(...neviimVerses.map(v => v.y));
      const minKetuvimY = Math.min(...ketuvimVerses.map(v => v.y));

      expect(maxNeviimY).toBeLessThan(minKetuvimY);
    });
  });

  describe('Book Structure', () => {
    it('contains all 5 Torah books', () => {
      const torahBooks = new Set(
        verses.filter(v => getSection(v.book) === 'torah').map(v => v.book)
      );
      expect(torahBooks).toEqual(new Set([
        'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'
      ]));
    });

    it('contains all 39 books', () => {
      const allBooks = new Set(verses.map(v => v.book));
      expect(allBooks.size).toBe(39);
    });
  });

  describe('No Overlapping Positions', () => {
    it('no two verses share the exact same position', () => {
      // Since there's jitter, we check for unique (x, y) pairs
      // With jitter, exact overlaps should be impossible
      const positions = new Map<string, TanakhLayout>();

      for (const v of verses) {
        const key = `${v.x.toFixed(1)},${v.y.toFixed(1)}`;
        const existing = positions.get(key);
        if (existing) {
          // Allow same position only if they're different due to jitter rounding
          const xDiff = Math.abs(v.x - existing.x);
          const yDiff = Math.abs(v.y - existing.y);
          // If they're at the same rounded position, the actual positions should differ
          expect(xDiff > 0.01 || yDiff > 0.01).toBe(true);
        }
        positions.set(key, v);
      }
    });
  });

  describe('Psalm 119 Handling', () => {
    it('Psalm 119 (176 verses) wraps to multiple lines', () => {
      const psalm119Verses = verses.filter(
        v => v.book === 'Psalms' && v.chapter === 119
      );

      expect(psalm119Verses.length).toBe(176);

      // Check that verses span multiple Y positions
      const uniqueYs = new Set(psalm119Verses.map(v => Math.round(v.y)));
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
