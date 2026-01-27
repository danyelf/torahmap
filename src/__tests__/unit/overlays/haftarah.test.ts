// Tests for haftarah overlay - parshiot and special occasions
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { haftarahOverlay } from '../../../overlays/haftarah';
import { createVerse } from '../../helpers/fixtures';
import { assertValidColor } from '../../helpers/assertions';
import type { VerseLayout } from '../../../types';

// Sample data matching the real structure
const SAMPLE_HAFTARAH_DATA = {
  parshiot: [
    {
      name: "Bereshit",
      hebrewName: "בראשית",
      torah: {
        book: "Genesis",
        start: { chapter: 1, verse: 1 },
        end: { chapter: 6, verse: 8 },
      },
      haftarah: {
        ashkenazi: [{
          book: "Isaiah",
          start: { chapter: 42, verse: 5 },
          end: { chapter: 42, verse: 21 },
        }],
        sephardi: [{
          book: "Isaiah",
          start: { chapter: 42, verse: 5 },
          end: { chapter: 43, verse: 10 },
        }],
      },
    },
    {
      name: "Noach",
      hebrewName: "נח",
      torah: {
        book: "Genesis",
        start: { chapter: 6, verse: 9 },
        end: { chapter: 11, verse: 32 },
      },
      haftarah: {
        ashkenazi: [{
          book: "Isaiah",
          start: { chapter: 54, verse: 1 },
          end: { chapter: 55, verse: 5 },
        }],
        sephardi: [{
          book: "Isaiah",
          start: { chapter: 54, verse: 1 },
          end: { chapter: 54, verse: 10 },
        }],
      },
    },
  ],
  specialOccasions: [
    {
      name: "Shabbat Rosh Chodesh",
      hebrewName: "שבת ראש חודש",
      category: "rosh-chodesh",
      haftarah: {
        ashkenazi: [{
          book: "Isaiah",
          start: { chapter: 66, verse: 1 },
          end: { chapter: 66, verse: 24 },
        }],
        sephardi: [{
          book: "Isaiah",
          start: { chapter: 66, verse: 1 },
          end: { chapter: 66, verse: 24 },
        }],
      },
    },
    {
      name: "Rosh Hashanah Day 1",
      hebrewName: "ראש השנה יום א׳",
      category: "high-holidays",
      haftarah: {
        ashkenazi: [{
          book: "I Samuel",
          start: { chapter: 1, verse: 1 },
          end: { chapter: 2, verse: 10 },
        }],
        sephardi: [{
          book: "I Samuel",
          start: { chapter: 1, verse: 1 },
          end: { chapter: 2, verse: 10 },
        }],
      },
    },
  ],
};

const SAMPLE_STRUCTURE = {
  books: [
    { name: "Genesis", hebrewName: "בראשית", chapters: [31, 25, 24, 26, 32, 22, 24, 22, 29, 32, 32, 20, 18, 24, 21, 16, 27, 33, 38, 18, 34, 24, 20, 67, 34, 35, 46, 22, 35, 43, 55, 32, 20, 31, 29, 43, 36, 30, 23, 23, 57, 38, 34, 34, 28, 34, 31, 22, 33, 26] },
    { name: "Isaiah", hebrewName: "ישעיהו", chapters: [31, 22, 26, 6, 30, 13, 25, 23, 20, 34, 16, 6, 22, 32, 9, 14, 14, 7, 25, 6, 17, 25, 18, 23, 12, 21, 13, 29, 24, 33, 9, 20, 24, 17, 10, 22, 38, 22, 8, 31, 29, 25, 28, 28, 25, 13, 15, 22, 26, 11, 23, 15, 12, 17, 13, 12, 21, 14, 21, 22, 11, 12, 19, 12, 25, 24] },
    { name: "I Samuel", hebrewName: "שמואל א", chapters: [28, 36, 21, 22, 12, 21, 17, 22, 27, 27, 15, 25, 23, 52, 35, 23, 58, 30, 24, 43, 15, 23, 28, 23, 44, 25, 12, 25, 11, 31, 13] },
  ],
};

describe('Haftarah Overlay', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFetch = vi.fn((url: string) => {
      if (url.includes('haftarah-mappings.json')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_HAFTARAH_DATA),
        } as Response);
      }
      if (url.includes('tanakh-structure.json')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(SAMPLE_STRUCTURE),
        } as Response);
      }
      return Promise.resolve({
        ok: false,
        status: 404,
      } as Response);
    });
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    haftarahOverlay.destroy?.();
  });

  describe('Overlay Interface', () => {
    it('has correct id and name', () => {
      expect(haftarahOverlay.id).toBe('haftarah');
      expect(haftarahOverlay.name).toBe('Haftarah');
    });
  });

  describe('Initialization', () => {
    it('loads haftarah mappings data on init', async () => {
      await haftarahOverlay.init?.();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('data/haftarah-mappings.json')
      );
    });

    it('loads tanakh structure data on init', async () => {
      await haftarahOverlay.init?.();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('data/tanakh-structure.json')
      );
    });

    it('handles fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
      } as Response);

      await expect(haftarahOverlay.init?.()).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('Torah Verses (Parshiot)', () => {
    beforeEach(async () => {
      await haftarahOverlay.init?.();
    });

    it('returns color for Torah verses in a parsha', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = haftarahOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('returns consistent color for same parsha', () => {
      const verse1 = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const verse2 = createVerse({ book: 'Genesis', chapter: 5, verse: 10 });

      const color1 = haftarahOverlay.getVerseColor(verse1);
      const color2 = haftarahOverlay.getVerseColor(verse2);

      expect(color1).toEqual(color2);
    });

    it('returns different colors for different parshiot', () => {
      const bereshitVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const noachVerse = createVerse({ book: 'Genesis', chapter: 7, verse: 1 });

      const color1 = haftarahOverlay.getVerseColor(bereshitVerse);
      const color2 = haftarahOverlay.getVerseColor(noachVerse);

      expect(color1).not.toEqual(color2);
    });
  });

  describe('Haftarah Verses (Parshiot)', () => {
    beforeEach(async () => {
      await haftarahOverlay.init?.();
    });

    it('returns color for haftarah verses', () => {
      // Isaiah 42:5-21 is haftarah for Bereshit (Ashkenazi)
      const verse = createVerse({ book: 'Isaiah', chapter: 42, verse: 10 });
      const color = haftarahOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('haftarah has same color as its Torah portion', () => {
      const torahVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const haftarahVerse = createVerse({ book: 'Isaiah', chapter: 42, verse: 10 });

      const torahColor = haftarahOverlay.getVerseColor(torahVerse);
      const haftarahColor = haftarahOverlay.getVerseColor(haftarahVerse);

      expect(torahColor).toEqual(haftarahColor);
    });
  });

  describe('Special Occasions', () => {
    beforeEach(async () => {
      await haftarahOverlay.init?.();
    });

    it('returns color for special occasion haftarah verses', () => {
      // Isaiah 66 is haftarah for Shabbat Rosh Chodesh
      const verse = createVerse({ book: 'Isaiah', chapter: 66, verse: 10 });
      const color = haftarahOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('returns color for high holiday haftarah verses', () => {
      // I Samuel 1-2 is haftarah for Rosh Hashanah Day 1
      const verse = createVerse({ book: 'I Samuel', chapter: 1, verse: 10 });
      const color = haftarahOverlay.getVerseColor(verse);

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('special occasions have different colors than parshiot', () => {
      const parshaVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const occasionVerse = createVerse({ book: 'Isaiah', chapter: 66, verse: 10 });

      const parshaColor = haftarahOverlay.getVerseColor(parshaVerse);
      const occasionColor = haftarahOverlay.getVerseColor(occasionVerse);

      expect(parshaColor).not.toEqual(occasionColor);
    });
  });

  describe('Hover Info', () => {
    beforeEach(async () => {
      await haftarahOverlay.init?.();
    });

    it('returns hover info for Torah verses', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const info = haftarahOverlay.getHoverInfo?.(verse);

      expect(info).toContain('Bereshit');
      expect(info).toContain('בראשית');
    });

    it('returns hover info for haftarah verses', () => {
      const verse = createVerse({ book: 'Isaiah', chapter: 42, verse: 10 });
      const info = haftarahOverlay.getHoverInfo?.(verse);

      expect(info).toContain('Bereshit');
      expect(info).toContain('Haftarah');
    });

    it('returns hover info for special occasion haftarah', () => {
      const verse = createVerse({ book: 'Isaiah', chapter: 66, verse: 10 });
      const info = haftarahOverlay.getHoverInfo?.(verse);

      expect(info).toContain('Shabbat Rosh Chodesh');
    });

    it('returns null for non-haftarah verses', () => {
      const verse = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });
      const info = haftarahOverlay.getHoverInfo?.(verse);

      expect(info).toBeNull();
    });
  });

  describe('Render Legend', () => {
    beforeEach(async () => {
      await haftarahOverlay.init?.();
    });

    it('renders legend with parsha count', () => {
      const container = document.createElement('div');
      haftarahOverlay.renderLegend?.(container);

      const innerHTML = container.innerHTML;
      expect(innerHTML).toContain('Parshiot');
    });

    it('renders legend with special occasions count', () => {
      const container = document.createElement('div');
      haftarahOverlay.renderLegend?.(container);

      const innerHTML = container.innerHTML;
      expect(innerHTML).toContain('Special Occasions');
    });

    it('mentions holidays in legend', () => {
      const container = document.createElement('div');
      haftarahOverlay.renderLegend?.(container);

      const innerHTML = container.innerHTML;
      expect(innerHTML).toContain('holidays');
    });
  });

  describe('Multi-Item Verses (Stipple)', () => {
    beforeEach(async () => {
      await haftarahOverlay.init?.();
    });

    it('returns color for haftarah verse (single item)', () => {
      // Isaiah 54:1-10 is Noach haftarah in our sample
      // This verse is only in Noach haftarah in our sample
      const verse = createVerse({ book: 'Isaiah', chapter: 54, verse: 5 });
      const color = haftarahOverlay.getVerseColor(verse);

      // Should return a single color since there's no overlap in sample
      expect(color).not.toBeNull();

      // The return can be Color or Color[], so check both cases
      if (Array.isArray(color) && Array.isArray(color[0])) {
        // Array of colors - multi-item verse
        for (const c of color as [number, number, number][]) {
          assertValidColor(c);
        }
      } else {
        // Single color
        assertValidColor(color as [number, number, number]);
      }
    });
  });

  describe('Color Distribution', () => {
    beforeEach(async () => {
      await haftarahOverlay.init?.();
    });

    it('distributes colors across rainbow spectrum', () => {
      const verse1 = createVerse({ book: 'Genesis', chapter: 1, verse: 1 }); // First parsha
      const verse2 = createVerse({ book: 'Isaiah', chapter: 66, verse: 10 }); // First special occasion

      const color1 = haftarahOverlay.getVerseColor(verse1) as [number, number, number];
      const color2 = haftarahOverlay.getVerseColor(verse2) as [number, number, number];

      expect(color1).not.toBeNull();
      expect(color2).not.toBeNull();

      // Colors should be different (different items get different hues)
      expect(color1).not.toEqual(color2);
    });

    it('colors are valid RGB values', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const color = haftarahOverlay.getVerseColor(verse) as [number, number, number];

      expect(color[0]).toBeGreaterThanOrEqual(0);
      expect(color[0]).toBeLessThanOrEqual(1);
      expect(color[1]).toBeGreaterThanOrEqual(0);
      expect(color[1]).toBeLessThanOrEqual(1);
      expect(color[2]).toBeGreaterThanOrEqual(0);
      expect(color[2]).toBeLessThanOrEqual(1);
    });
  });

  describe('Non-Relevant Verses', () => {
    beforeEach(async () => {
      await haftarahOverlay.init?.();
    });

    it('returns null for non-Torah non-haftarah verses', () => {
      const verse = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });
      const color = haftarahOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });

    it('returns null for book not in any reading', () => {
      const verse = createVerse({ book: 'Ruth', chapter: 1, verse: 1 });
      const color = haftarahOverlay.getVerseColor(verse);

      expect(color).toBeNull();
    });
  });

  describe('Hover State (setHoveredVerse)', () => {
    beforeEach(async () => {
      await haftarahOverlay.init?.();
    });

    it('returns true when hovering relevant verse from null', () => {
      const torahVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const shouldRerender = haftarahOverlay.setHoveredVerse?.(torahVerse);

      expect(shouldRerender).toBe(true);
    });

    it('returns true when clearing hover from relevant verse', () => {
      const torahVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      haftarahOverlay.setHoveredVerse?.(torahVerse);

      const shouldRerender = haftarahOverlay.setHoveredVerse?.(null);

      expect(shouldRerender).toBe(true);
    });

    it('returns false when moving between non-relevant verses', () => {
      const psalmsVerse = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });
      const ruthVerse = createVerse({ book: 'Ruth', chapter: 1, verse: 1 });

      haftarahOverlay.setHoveredVerse?.(psalmsVerse);
      const shouldRerender = haftarahOverlay.setHoveredVerse?.(ruthVerse);

      expect(shouldRerender).toBe(false);
    });

    it('returns true when moving from relevant to non-relevant verse', () => {
      const torahVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const psalmsVerse = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });

      haftarahOverlay.setHoveredVerse?.(torahVerse);
      const shouldRerender = haftarahOverlay.setHoveredVerse?.(psalmsVerse);

      expect(shouldRerender).toBe(true);
    });

    it('returns false when clearing hover after non-relevant verse (bug fix)', () => {
      // This tests the bug where dimmed state persisted after mouse left canvas
      const torahVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const psalmsVerse = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });

      // Hover relevant verse (causes dimming)
      haftarahOverlay.setHoveredVerse?.(torahVerse);
      // Move to non-relevant verse
      haftarahOverlay.setHoveredVerse?.(psalmsVerse);
      // Move off canvas (null)
      const shouldRerender = haftarahOverlay.setHoveredVerse?.(null);

      // Should return false because hover is already effectively cleared
      // (non-relevant verses are treated as null)
      expect(shouldRerender).toBe(false);
    });

    it('restores base colors after hovering non-relevant verse', () => {
      const torahVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const psalmsVerse = createVerse({ book: 'Psalms', chapter: 1, verse: 1 });

      // Get base color (no hover)
      const baseColor = haftarahOverlay.getVerseColor(torahVerse);

      // Hover relevant verse, then non-relevant verse
      haftarahOverlay.setHoveredVerse?.(torahVerse);
      haftarahOverlay.setHoveredVerse?.(psalmsVerse);

      // After moving to non-relevant verse, should see base color (not desaturated)
      const colorAfterNonRelevant = haftarahOverlay.getVerseColor(torahVerse);

      expect(colorAfterNonRelevant).toEqual(baseColor);
    });

    it('brightens hovered relevant verse and its related verses', () => {
      const torahVerse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      const otherParsha = createVerse({ book: 'Genesis', chapter: 7, verse: 1 }); // Noach

      // Get base colors
      const baseTorahColor = haftarahOverlay.getVerseColor(torahVerse) as [number, number, number];
      const baseOtherColor = haftarahOverlay.getVerseColor(otherParsha) as [number, number, number];

      // Hover the torah verse
      haftarahOverlay.setHoveredVerse?.(torahVerse);

      const hoveredColor = haftarahOverlay.getVerseColor(torahVerse) as [number, number, number];
      const otherColor = haftarahOverlay.getVerseColor(otherParsha) as [number, number, number];

      // Hovered verse should be brighter
      const hoveredBrightness = hoveredColor[0] + hoveredColor[1] + hoveredColor[2];
      const baseBrightness = baseTorahColor[0] + baseTorahColor[1] + baseTorahColor[2];
      expect(hoveredBrightness).toBeGreaterThan(baseBrightness);

      // Other verse should be desaturated (lower saturation, similar lightness)
      // We can verify it's different from base
      expect(otherColor).not.toEqual(baseOtherColor);
    });
  });
});
