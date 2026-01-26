// Tests for divine-names overlay - YHWH/Elohim color mapping, Torah-only behavior
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { divineNamesOverlay } from '../../../overlays/divine-names';
import { createVerse, SAMPLE_DIVINE_NAMES_DATA } from '../../helpers/fixtures';
import { assertValidColor, assertColorEquals } from '../../helpers/assertions';
import type { DivineNamesData, VerseLayout } from '../../../types';

describe('Divine Names Overlay', () => {
  let testData: DivineNamesData;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup test data matching the overlay's color scheme
    // 0 = no divine name, 1 = YHWH, 2 = Elohim, 3 = both
    testData = {
      'Genesis': [
        // Chapter 1: [verse codes...]
        [2, 2, 0, 2, 0, 1, 2, 2, 0, 2], // 10 verses
        [1, 2, 3, 0, 1, 2, 0, 1], // 8 verses in chapter 2
      ],
      'Exodus': [
        [1, 0, 2, 1, 0, 3, 1, 2], // 8 verses in chapter 1
        [2, 1, 0, 2, 1], // 5 verses in chapter 2
      ],
      'Leviticus': [
        [1, 1, 1, 2, 2, 0], // 6 verses
      ],
    };

    // Mock fetch
    mockFetch = vi.fn((url: string) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testData),
      } as Response);
    });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Overlay Interface', () => {
    it('has correct id and name', () => {
      expect(divineNamesOverlay.id).toBe('divine-names');
      expect(divineNamesOverlay.name).toBe('Divine Names');
    });
  });

  describe('Initialization', () => {
    it('loads divine names data on init', async () => {
      await divineNamesOverlay.init?.();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('data/divine-names.json')
      );
    });

    it('handles fetch errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Should not throw
      await expect(divineNamesOverlay.init?.()).resolves.not.toThrow();
    });

    it('handles JSON parse errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Parse error')),
      } as Response);

      // Should not throw
      await expect(divineNamesOverlay.init?.()).resolves.not.toThrow();
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw
      await expect(divineNamesOverlay.init?.()).resolves.not.toThrow();
    });
  });

  describe('Color Mapping - YHWH (code 1)', () => {
    beforeEach(async () => {
      await divineNamesOverlay.init?.();
    });

    it('returns blue color for YHWH verses', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 2, verse: 1 }); // code 1
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);

      // YHWH color is [0.3, 0.5, 0.9] - blue
      const colorArray = color as [number, number, number];
      expect(colorArray[0]).toBeCloseTo(0.3, 1);
      expect(colorArray[1]).toBeCloseTo(0.5, 1);
      expect(colorArray[2]).toBeCloseTo(0.9, 1);
    });

    it('returns consistent blue color for all YHWH verses', () => {
      const verses = [
        createVerse({ book: 'Genesis', chapter: 2, verse: 1 }), // YHWH
        createVerse({ book: 'Genesis', chapter: 2, verse: 5 }), // YHWH
        createVerse({ book: 'Exodus', chapter: 1, verse: 1 }), // YHWH
        createVerse({ book: 'Exodus', chapter: 2, verse: 2 }), // YHWH
      ];

      const colors = verses.map(v => divineNamesOverlay.getVerseColor(v));

      // All should be the same blue
      for (const color of colors) {
        expect(color).not.toBeNull();
        assertColorEquals(color as [number, number, number], [0.3, 0.5, 0.9]);
      }
    });

    it('blue has highest value in blue channel', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 2, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse) as [number, number, number];

      // Blue channel should be highest
      expect(color[2]).toBeGreaterThan(color[0]);
      expect(color[2]).toBeGreaterThan(color[1]);
    });
  });

  describe('Color Mapping - Elohim (code 2)', () => {
    beforeEach(async () => {
      await divineNamesOverlay.init?.();
    });

    it('returns red color for Elohim verses', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 }); // code 2
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);

      // Elohim color is [0.9, 0.3, 0.3] - red
      const colorArray = color as [number, number, number];
      expect(colorArray[0]).toBeCloseTo(0.9, 1);
      expect(colorArray[1]).toBeCloseTo(0.3, 1);
      expect(colorArray[2]).toBeCloseTo(0.3, 1);
    });

    it('returns consistent red color for all Elohim verses', () => {
      const verses = [
        createVerse({ book: 'Genesis', chapter: 1, verse: 1 }), // Elohim
        createVerse({ book: 'Genesis', chapter: 1, verse: 2 }), // Elohim
        createVerse({ book: 'Exodus', chapter: 1, verse: 3 }), // Elohim
        createVerse({ book: 'Exodus', chapter: 2, verse: 1 }), // Elohim
      ];

      const colors = verses.map(v => divineNamesOverlay.getVerseColor(v));

      // All should be the same red
      for (const color of colors) {
        expect(color).not.toBeNull();
        assertColorEquals(color as [number, number, number], [0.9, 0.3, 0.3]);
      }
    });

    it('red has highest value in red channel', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse) as [number, number, number];

      // Red channel should be highest
      expect(color[0]).toBeGreaterThan(color[1]);
      expect(color[0]).toBeGreaterThan(color[2]);
    });
  });

  describe('Color Mapping - Both Names (code 3)', () => {
    beforeEach(async () => {
      await divineNamesOverlay.init?.();
    });

    it('returns purple color for verses with both names', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 2, verse: 3 }); // code 3
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);

      // Both color is [0.7, 0.3, 0.8] - purple
      const colorArray = color as [number, number, number];
      expect(colorArray[0]).toBeCloseTo(0.7, 1);
      expect(colorArray[1]).toBeCloseTo(0.3, 1);
      expect(colorArray[2]).toBeCloseTo(0.8, 1);
    });

    it('returns consistent purple color for all verses with both names', () => {
      const verses = [
        createVerse({ book: 'Genesis', chapter: 2, verse: 3 }), // Both
        createVerse({ book: 'Exodus', chapter: 1, verse: 6 }), // Both
      ];

      const colors = verses.map(v => divineNamesOverlay.getVerseColor(v));

      // All should be the same purple
      for (const color of colors) {
        expect(color).not.toBeNull();
        assertColorEquals(color as [number, number, number], [0.7, 0.3, 0.8]);
      }
    });

    it('purple is a blend of red and blue', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 2, verse: 3 });
      const color = divineNamesOverlay.getVerseColor(verse) as [number, number, number];

      // Purple should have high red and blue, low green
      expect(color[0]).toBeGreaterThan(0.5); // Red
      expect(color[2]).toBeGreaterThan(0.5); // Blue
      expect(color[1]).toBeLessThan(0.5);    // Green
    });
  });

  describe('Color Mapping - No Divine Name (code 0)', () => {
    beforeEach(async () => {
      await divineNamesOverlay.init?.();
    });

    it('returns null for verses with no divine name', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 3 }); // code 0
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });

    it('returns null for all verses with code 0', () => {
      const verses = [
        createVerse({ book: 'Genesis', chapter: 1, verse: 3 }), // code 0
        createVerse({ book: 'Genesis', chapter: 1, verse: 5 }), // code 0
        createVerse({ book: 'Genesis', chapter: 2, verse: 4 }), // code 0
        createVerse({ book: 'Exodus', chapter: 1, verse: 2 }), // code 0
      ];

      for (const verse of verses) {
        const color = divineNamesOverlay.getVerseColor(verse);
        expect(color).toBeNull();
      }
    });
  });

  describe('Color Distinction', () => {
    beforeEach(async () => {
      await divineNamesOverlay.init?.();
    });

    it('YHWH and Elohim have different colors', () => {
      const yhwhVerse = createVerse({ book: 'Genesis', chapter: 2, verse: 1 }); // YHWH
      const elohimVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 }); // Elohim

      const yhwhColor = divineNamesOverlay.getVerseColor(yhwhVerse);
      const elohimColor = divineNamesOverlay.getVerseColor(elohimVerse);

      expect(yhwhColor).not.toEqual(elohimColor);
    });

    it('YHWH and Both have different colors', () => {
      const yhwhVerse = createVerse({ book: 'Genesis', chapter: 2, verse: 1 }); // YHWH
      const bothVerse = createVerse({ book: 'Genesis', chapter: 2, verse: 3 }); // Both

      const yhwhColor = divineNamesOverlay.getVerseColor(yhwhVerse);
      const bothColor = divineNamesOverlay.getVerseColor(bothVerse);

      expect(yhwhColor).not.toEqual(bothColor);
    });

    it('Elohim and Both have different colors', () => {
      const elohimVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 }); // Elohim
      const bothVerse = createVerse({ book: 'Genesis', chapter: 2, verse: 3 }); // Both

      const elohimColor = divineNamesOverlay.getVerseColor(elohimVerse);
      const bothColor = divineNamesOverlay.getVerseColor(bothVerse);

      expect(elohimColor).not.toEqual(bothColor);
    });

    it('all three colors are visually distinct', () => {
      const yhwhColor = divineNamesOverlay.getVerseColor(
        createVerse({ book: 'Genesis', chapter: 2, verse: 1 })
      ) as [number, number, number];

      const elohimColor = divineNamesOverlay.getVerseColor(
        createVerse({ book: 'Genesis', chapter: 1, verse: 1 })
      ) as [number, number, number];

      const bothColor = divineNamesOverlay.getVerseColor(
        createVerse({ book: 'Genesis', chapter: 2, verse: 3 })
      ) as [number, number, number];

      // Calculate perceptual distance between colors
      const distance = (c1: [number, number, number], c2: [number, number, number]) => {
        return Math.sqrt(
          Math.pow(c1[0] - c2[0], 2) +
          Math.pow(c1[1] - c2[1], 2) +
          Math.pow(c1[2] - c2[2], 2)
        );
      };

      // All pairs should be visually distinct (distance > 0.3)
      expect(distance(yhwhColor, elohimColor)).toBeGreaterThan(0.3);
      expect(distance(yhwhColor, bothColor)).toBeGreaterThan(0.3);
      expect(distance(elohimColor, bothColor)).toBeGreaterThan(0.3);
    });
  });

  describe('Torah-Only Behavior', () => {
    beforeEach(async () => {
      await divineNamesOverlay.init?.();
    });

    it('works for Torah books (Genesis)', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
    });

    it('works for Torah books (Exodus)', () => {
      const verse = createVerse({ book: 'Exodus', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
    });

    it('works for Torah books (Leviticus)', () => {
      const verse = createVerse({ book: 'Leviticus', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
    });

    it('returns null for Nevi\'im books', () => {
      const verses = [
        createVerse({ book: 'Joshua', chapter: 1, verse: 1 }),
        createVerse({ book: 'Judges', chapter: 1, verse: 1 }),
        createVerse({ book: 'Samuel I', chapter: 1, verse: 1 }),
        createVerse({ book: 'Kings I', chapter: 1, verse: 1 }),
        createVerse({ book: 'Isaiah', chapter: 1, verse: 1 }),
        createVerse({ book: 'Jeremiah', chapter: 1, verse: 1 }),
        createVerse({ book: 'Ezekiel', chapter: 1, verse: 1 }),
      ];

      for (const verse of verses) {
        const color = divineNamesOverlay.getVerseColor(verse);
        expect(color).toBeNull();
      }
    });

    it('returns null for Ketuvim books', () => {
      const verses = [
        createVerse({ book: 'Psalms', chapter: 1, verse: 1 }),
        createVerse({ book: 'Proverbs', chapter: 1, verse: 1 }),
        createVerse({ book: 'Job', chapter: 1, verse: 1 }),
        createVerse({ book: 'Ruth', chapter: 1, verse: 1 }),
        createVerse({ book: 'Esther', chapter: 1, verse: 1 }),
        createVerse({ book: 'Daniel', chapter: 1, verse: 1 }),
        createVerse({ book: 'Ezra', chapter: 1, verse: 1 }),
        createVerse({ book: 'Chronicles I', chapter: 1, verse: 1 }),
      ];

      for (const verse of verses) {
        const color = divineNamesOverlay.getVerseColor(verse);
        expect(color).toBeNull();
      }
    });

    it('returns null for books not in data', () => {
      const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });
  });

  describe('Data Indexing', () => {
    beforeEach(async () => {
      await divineNamesOverlay.init?.();
    });

    it('uses zero-based chapter indexing', () => {
      // Chapter 1 is at index 0
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).not.toBeNull(); // Should find data
    });

    it('uses zero-based verse indexing', () => {
      // Verse 1 is at index 0
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      // Should map to code 2 (Elohim - red)
      assertColorEquals(color as [number, number, number], [0.9, 0.3, 0.3]);
    });

    it('handles different chapters correctly', () => {
      const ch1v1 = createVerse({ book: 'Genesis', chapter: 1, verse: 1 }); // Elohim
      const ch2v1 = createVerse({ book: 'Genesis', chapter: 2, verse: 1 }); // YHWH

      const color1 = divineNamesOverlay.getVerseColor(ch1v1);
      const color2 = divineNamesOverlay.getVerseColor(ch2v1);

      // Should be different colors
      expect(color1).not.toEqual(color2);
    });

    it('handles different verses in same chapter correctly', () => {
      const v1 = createVerse({ book: 'Genesis', chapter: 1, verse: 1 }); // code 2
      const v6 = createVerse({ book: 'Genesis', chapter: 1, verse: 6 }); // code 1

      const color1 = divineNamesOverlay.getVerseColor(v1);
      const color6 = divineNamesOverlay.getVerseColor(v6);

      // Should be different colors (Elohim vs YHWH)
      expect(color1).not.toEqual(color6);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await divineNamesOverlay.init?.();
    });

    it('handles missing book gracefully', () => {
      const verse = createVerse({ book: 'Deuteronomy', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });

    it('handles chapter out of range', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 999, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });

    it('handles verse out of range', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 999 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });

    it('handles chapter 0', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 0, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });

    it('handles verse 0', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 0 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });

    it('handles negative chapter', () => {
      const verse = createVerse({ book: 'Genesis', chapter: -1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });

    it('handles negative verse', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: -1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });

    it('handles empty book name', () => {
      const verse = createVerse({ book: '', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });

    it('handles invalid code in data (code 4)', async () => {
      const invalidData: DivineNamesData = {
        'Genesis': [[4]], // Invalid code
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidData),
      } as Response);

      await divineNamesOverlay.init?.();

      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      // Invalid codes should return null
      expect(color).toBeNull();
    });

    it('handles invalid code in data (code -1)', async () => {
      const invalidData: DivineNamesData = {
        'Genesis': [[-1]], // Invalid code
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(invalidData),
      } as Response);

      await divineNamesOverlay.init?.();

      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      // Invalid codes should return null
      expect(color).toBeNull();
    });
  });

  describe('Render Legend', () => {
    beforeEach(async () => {
      await divineNamesOverlay.init?.();
    });

    it('renders legend with three entries', () => {
      const container = document.createElement('div');
      divineNamesOverlay.renderLegend?.(container);

      const rows = container.querySelectorAll('.legend-row');
      expect(rows.length).toBe(3);
    });

    it('includes YHWH in legend', () => {
      const container = document.createElement('div');
      divineNamesOverlay.renderLegend?.(container);

      const innerHTML = container.innerHTML;
      expect(innerHTML).toContain('YHWH');
    });

    it('includes Elohim in legend', () => {
      const container = document.createElement('div');
      divineNamesOverlay.renderLegend?.(container);

      const innerHTML = container.innerHTML;
      expect(innerHTML).toContain('Elohim');
    });

    it('includes Both in legend', () => {
      const container = document.createElement('div');
      divineNamesOverlay.renderLegend?.(container);

      const innerHTML = container.innerHTML;
      expect(innerHTML).toContain('Both');
    });

    it('includes color swatches', () => {
      const container = document.createElement('div');
      divineNamesOverlay.renderLegend?.(container);

      const swatches = container.querySelectorAll('.swatch');
      expect(swatches.length).toBe(3);
    });

    it('YHWH swatch has blue background', () => {
      const container = document.createElement('div');
      divineNamesOverlay.renderLegend?.(container);

      const innerHTML = container.innerHTML;
      // Blue color: [0.3, 0.5, 0.9] = rgb(77, 128, 230)
      expect(innerHTML).toContain('rgb(77, 128, 230)');
    });

    it('Elohim swatch has red background', () => {
      const container = document.createElement('div');
      divineNamesOverlay.renderLegend?.(container);

      const innerHTML = container.innerHTML;
      // Red color: [0.9, 0.3, 0.3] = rgb(230, 77, 77)
      expect(innerHTML).toContain('rgb(230, 77, 77)');
    });

    it('Both swatch has purple background', () => {
      const container = document.createElement('div');
      divineNamesOverlay.renderLegend?.(container);

      const innerHTML = container.innerHTML;
      // Purple color: [0.7, 0.3, 0.8] = rgb(179, 77, 204)
      expect(innerHTML).toContain('rgb(179, 77, 204)');
    });
  });

  describe('Hover Info', () => {
    beforeEach(async () => {
      await divineNamesOverlay.init?.();
    });

    it('returns "YHWH" for YHWH verses', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 2, verse: 1 }); // code 1
      const info = divineNamesOverlay.getHoverInfo?.(verse);

      expect(info).toBe('YHWH');
    });

    it('returns "Elohim" for Elohim verses', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 }); // code 2
      const info = divineNamesOverlay.getHoverInfo?.(verse);

      expect(info).toBe('Elohim');
    });

    it('returns "YHWH + Elohim" for verses with both', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 2, verse: 3 }); // code 3
      const info = divineNamesOverlay.getHoverInfo?.(verse);

      expect(info).toBe('YHWH + Elohim');
    });

    it('returns null for verses without divine names', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 3 }); // code 0
      const info = divineNamesOverlay.getHoverInfo?.(verse);

      expect(info).toBeNull();
    });

    it('returns null for non-Torah books', () => {
      const verse = createVerse({ book: 'Isaiah', chapter: 1, verse: 1 });
      const info = divineNamesOverlay.getHoverInfo?.(verse);

      expect(info).toBeNull();
    });

    it('returns null for missing data', () => {
      const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
      const info = divineNamesOverlay.getHoverInfo?.(verse);

      expect(info).toBeNull();
    });
  });

  describe('Data Loading States', () => {
    it('handles uninitialized state gracefully', () => {
      // Note: Due to module-level state, data may persist from other tests
      // The important thing is that getVerseColor doesn't throw
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });

      expect(() => divineNamesOverlay.getVerseColor(verse)).not.toThrow();
    });

    it('works after initialization', async () => {
      await divineNamesOverlay.init?.();

      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
    });

    it('handles empty data object', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      } as Response);

      await divineNamesOverlay.init?.();

      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });

    it('handles malformed data gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 'Genesis': 'not-an-array' }),
      } as Response);

      await divineNamesOverlay.init?.();

      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });

      // Should not throw
      expect(() => divineNamesOverlay.getVerseColor(verse)).not.toThrow();
    });
  });

  describe('All Divine Name Codes', () => {
    beforeEach(async () => {
      await divineNamesOverlay.init?.();
    });

    it('handles code 0 (no divine name)', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 3 });
      const color = divineNamesOverlay.getVerseColor(verse);
      expect(color).toBeNull();
    });

    it('handles code 1 (YHWH)', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 2, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);
      expect(color).not.toBeNull();
      assertColorEquals(color as [number, number, number], [0.3, 0.5, 0.9]);
    });

    it('handles code 2 (Elohim)', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);
      expect(color).not.toBeNull();
      assertColorEquals(color as [number, number, number], [0.9, 0.3, 0.3]);
    });

    it('handles code 3 (both)', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 2, verse: 3 });
      const color = divineNamesOverlay.getVerseColor(verse);
      expect(color).not.toBeNull();
      assertColorEquals(color as [number, number, number], [0.7, 0.3, 0.8]);
    });
  });

  describe('Consistency', () => {
    beforeEach(async () => {
      await divineNamesOverlay.init?.();
    });

    it('returns same color for same verse called multiple times', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });

      const color1 = divineNamesOverlay.getVerseColor(verse);
      const color2 = divineNamesOverlay.getVerseColor(verse);
      const color3 = divineNamesOverlay.getVerseColor(verse);

      expect(color1).toEqual(color2);
      expect(color2).toEqual(color3);
    });

    it('returns same color for equivalent verse objects', () => {
      const verse1 = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const verse2 = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });

      const color1 = divineNamesOverlay.getVerseColor(verse1);
      const color2 = divineNamesOverlay.getVerseColor(verse2);

      expect(color1).toEqual(color2);
    });

    it('verse position does not affect color', () => {
      const verse1 = createVerse({ book: 'Genesis', chapter: 1, verse: 1, x: 10, y: 20 });
      const verse2 = createVerse({ book: 'Genesis', chapter: 1, verse: 1, x: 100, y: 200 });

      const color1 = divineNamesOverlay.getVerseColor(verse1);
      const color2 = divineNamesOverlay.getVerseColor(verse2);

      expect(color1).toEqual(color2);
    });
  });

  describe('Sample Data Integration', () => {
    it('works with SAMPLE_DIVINE_NAMES_DATA from fixtures', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(SAMPLE_DIVINE_NAMES_DATA),
      } as Response);

      await divineNamesOverlay.init?.();

      // Test a verse from sample data
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = divineNamesOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });
  });
});
