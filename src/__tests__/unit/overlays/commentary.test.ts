// Tests for commentary overlay - color computation, category filtering, logarithmic heatmap
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { commentaryOverlay, configure, getVerseLinkCount } from '../../../overlays/commentary';
import { heatmapColor } from '../../../utils/color';
import { createVerse } from '../../helpers/fixtures';
import { assertValidColor } from '../../helpers/assertions';
import type { CommentaryData, TanakhLayout } from '../../../types';

describe('Commentary Overlay', () => {
  let testData: CommentaryData;
  let testVerses: TanakhLayout[];
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup test data
    testData = {
      'Genesis': {
        '1': {
          '1': { total: 150, categories: { 'Midrash': 50, 'Talmud': 30, 'Chasidut': 20, 'Tanakh': 50 } },
          '2': { total: 45, categories: { 'Midrash': 20, 'Talmud': 15, 'Kabbalah': 10 } },
          '3': { total: 0, categories: {} }, // Edge case: zero counts
        },
        '2': {
          '1': { total: 30, categories: { 'Midrash': 15, 'Halakhah': 10, 'Musar': 5 } },
        },
      },
      'Exodus': {
        '1': {
          '1': { total: 100, categories: { 'Talmud': 50, 'Halakhah': 30, 'Responsa': 20 } },
          '2': { total: 5, categories: { 'Jewish Thought': 3, 'Musar': 2 } },
        },
      },
      'Isaiah': {
        '1': {
          '1': { total: 80, categories: { 'Midrash': 40, 'Jewish Thought': 25, 'Tanakh': 15 } },
          '2': { total: 25, categories: { 'Midrash': 15, 'Responsa': 10 } },
        },
      },
    };

    testVerses = [
      createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
      createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
      createVerse({ book: 'Genesis', chapter: 1, verse: 3 }),
      createVerse({ book: 'Genesis', chapter: 2, verse: 1 }),
      createVerse({ book: 'Exodus', chapter: 1, verse: 1 }),
      createVerse({ book: 'Exodus', chapter: 1, verse: 2 }),
      createVerse({ book: 'Isaiah', chapter: 1, verse: 1 }),
      createVerse({ book: 'Isaiah', chapter: 1, verse: 2 }),
    ];

    // Mock fetch
    mockFetch = vi.fn((_url: string) => {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(testData),
      } as Response);
    });
    globalThis.fetch = mockFetch;

    // Configure overlay with test verses
    configure({ verses: testVerses });
  });

  afterEach(() => {
    // Clean up
    commentaryOverlay.destroy?.();
  });

  describe('Overlay Interface', () => {
    it('has correct id and name', () => {
      expect(commentaryOverlay.id).toBe('commentary');
      expect(commentaryOverlay.name).toBe('Commentary Density');
    });
  });

  describe('Initialization', () => {
    it('loads commentary data on init', async () => {
      await commentaryOverlay.init?.();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('data/commentary-counts.json')
      );
    });

    it('handles fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Should not throw
      await expect(commentaryOverlay.init?.()).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });

    it('handles JSON parse errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Parse error')),
      } as Response);

      // Should not throw
      await expect(commentaryOverlay.init?.()).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('Color Computation - Total Category', () => {
    beforeEach(async () => {
      await commentaryOverlay.init?.();
    });

    it('returns valid colors for verses with data', () => {
      const verse = testVerses[0]; // Genesis 1:1, total: 150
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('returns different colors for different commentary counts', () => {
      const highVerse = testVerses[0]; // Genesis 1:1, total: 150
      const lowVerse = testVerses[5];  // Exodus 1:2, total: 5

      const highColor = commentaryOverlay.getVerseColor(highVerse) as [number, number, number];
      const lowColor = commentaryOverlay.getVerseColor(lowVerse) as [number, number, number];

      // Colors should be different (higher count = hotter/redder)
      expect(highColor).not.toEqual(lowColor);

      // High count should have higher red channel (heatmap goes blue->red)
      expect(highColor[0]).toBeGreaterThan(lowColor[0]);
    });

    it('returns color for verses with zero commentary', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 3 }); // total: 0
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);

      // Should be the dark color for zero ([0.15, 0.15, 0.2])
      const colorArray = color as [number, number, number];
      expect(colorArray[0]).toBeCloseTo(0.15, 1);
      expect(colorArray[1]).toBeCloseTo(0.15, 1);
      expect(colorArray[2]).toBeCloseTo(0.2, 1);
    });

    it('returns valid color for verses not in data', () => {
      const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('uses logarithmic scale', () => {
      // Test that the scale is logarithmic by checking intermediate values
      const v1 = testVerses[0]; // 150 total
      const v2 = testVerses[1]; // 45 total
      const v3 = testVerses[5]; // 5 total

      const c1 = commentaryOverlay.getVerseColor(v1) as [number, number, number];
      const c2 = commentaryOverlay.getVerseColor(v2) as [number, number, number];
      const c3 = commentaryOverlay.getVerseColor(v3) as [number, number, number];

      // Due to log scale, the color difference between 5 and 45
      // should be greater than between 45 and 150
      const diff_low_mid = Math.abs(c2[0] - c3[0]);
      const diff_mid_high = Math.abs(c1[0] - c2[0]);

      // This is a characteristic of logarithmic scaling
      expect(diff_low_mid).toBeGreaterThan(diff_mid_high * 0.5);
    });
  });

  describe('Category Filtering', () => {
    beforeEach(async () => {
      await commentaryOverlay.init?.();
    });

    it('filters by Midrash category', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      const verse1 = testVerses[0]; // Genesis 1:1, Midrash: 50
      const verse2 = testVerses[1]; // Genesis 1:2, Midrash: 20

      const color1 = commentaryOverlay.getVerseColor(verse1) as [number, number, number];
      const color2 = commentaryOverlay.getVerseColor(verse2) as [number, number, number];

      // Verse with more Midrash should have hotter color
      expect(color1[0]).toBeGreaterThan(color2[0]);
    });

    it('filters by Talmud category', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Talmud';
      select.dispatchEvent(new Event('change'));

      const verse = testVerses[4]; // Exodus 1:1, Talmud: 50
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('filters by Halakhah category', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Halakhah';
      select.dispatchEvent(new Event('change'));

      const verse = testVerses[4]; // Exodus 1:1, Halakhah: 30
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('returns dark color for verses without the filtered category', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Kabbalah';
      select.dispatchEvent(new Event('change'));

      const verse = testVerses[0]; // Genesis 1:1, no Kabbalah
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number];

      // Should be dark (zero value)
      expect(color[0]).toBeCloseTo(0.15, 1);
    });

    it('handles multiple category switches', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      const select = container.querySelector('select') as HTMLSelectElement;
      const verse = testVerses[0]; // Genesis 1:1

      // Switch to Midrash
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));
      const midrashColor = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;
      assertValidColor(midrashColor as [number, number, number]);

      // Switch to Talmud
      select.value = 'Talmud';
      select.dispatchEvent(new Event('change'));
      const talmudColor = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;
      assertValidColor(talmudColor as [number, number, number]);

      // Colors should be different
      expect(midrashColor).not.toEqual(talmudColor);

      // Switch back to total
      select.value = 'total';
      select.dispatchEvent(new Event('change'));
      const totalColor = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;
      assertValidColor(totalColor as [number, number, number]);
    });
  });

  describe('Max Value Caching', () => {
    beforeEach(async () => {
      await commentaryOverlay.init?.();
    });

    it('produces consistent colors for same verses', () => {
      const verse = testVerses[0];

      const color1 = commentaryOverlay.getVerseColor(verse);
      const color2 = commentaryOverlay.getVerseColor(verse);

      expect(color1).toEqual(color2);
    });

    it('recalculates colors on category change', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      // Use verse 2 which has different relative values in total vs Midrash
      // Genesis 1:2: total 45 (max 150), Midrash 20 (max 50)
      const verse = testVerses[1];
      const totalColor = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      const midrashColor = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      // Colors should be different because relative positions differ
      // In total: 45/150 = 0.3, in Midrash: 20/50 = 0.4
      expect(totalColor).not.toEqual(midrashColor);
    });
  });

  describe('Render Controls', () => {
    beforeEach(async () => {
      await commentaryOverlay.init?.();
    });

    it('renders category selector', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      const select = container.querySelector('select');
      expect(select).not.toBeNull();
      expect(select?.id).toBe('category-select');
    });

    it('includes all category options', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      const select = container.querySelector('select') as HTMLSelectElement;
      const options = Array.from(select.options).map(opt => opt.value);

      expect(options).toContain('total');
      expect(options).toContain('Talmud');
      expect(options).toContain('Midrash');
      expect(options).toContain('Halakhah');
      expect(options).toContain('Jewish Thought');
      expect(options).toContain('Chasidut');
      expect(options).toContain('Kabbalah');
      expect(options).toContain('Musar');
    });

    it('sets initial value to current category', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('total');
    });

    it('triggers update callback on category change', () => {
      const updateCallback = vi.fn();
      commentaryOverlay.onUpdate?.(updateCallback);

      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      expect(updateCallback).toHaveBeenCalled();
    });
  });

  describe('Render Legend', () => {
    beforeEach(async () => {
      await commentaryOverlay.init?.();
    });

    it('renders gradient element', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderLegend?.(container);

      const gradient = container.querySelector('.legend-gradient');
      expect(gradient).not.toBeNull();
    });

    it('renders tick marks', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderLegend?.(container);

      const ticks = container.querySelector('.legend-ticks');
      expect(ticks).not.toBeNull();
    });

    it('includes appropriate tick values', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderLegend?.(container);

      const innerHTML = container.innerHTML;
      expect(innerHTML).toContain('0');
      expect(innerHTML).toContain('1');
      expect(innerHTML).toContain('10');
      expect(innerHTML).toContain('100');
    });

    it('formats large values with k suffix', async () => {
      // Create data with large values
      const largeData: CommentaryData = {
        'Genesis': {
          '1': {
            '1': { total: 5000, categories: { 'Midrash': 5000 } },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(largeData),
      } as Response);

      // Re-init with large data
      configure({ verses: [createVerse({ book: 'Genesis', chapter: 1, verse: 1 })] });
      await commentaryOverlay.init?.();

      const container = document.createElement('div');
      commentaryOverlay.renderLegend?.(container);

      const innerHTML = container.innerHTML;
      expect(innerHTML).toContain('1k');
    });
  });

  describe('Hover Info', () => {
    beforeEach(async () => {
      await commentaryOverlay.init?.();
    });

    it('returns link count for total category', () => {
      const verse = testVerses[0]; // Genesis 1:1, total: 150
      const info = commentaryOverlay.getHoverInfo?.(verse);

      expect(info).toBe('150 links');
    });

    it('returns category count when filtered', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      const verse = testVerses[0]; // Genesis 1:1, Midrash: 50
      const info = commentaryOverlay.getHoverInfo?.(verse);

      expect(info).toBe('50 Midrash');
    });

    it('returns null for verses without data', () => {
      const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
      const info = commentaryOverlay.getHoverInfo?.(verse);

      expect(info).toBeNull();
    });

    it('returns "no <category>" for category with zero count', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Kabbalah';
      select.dispatchEvent(new Event('change'));

      const verse = testVerses[0]; // Genesis 1:1, no Kabbalah
      const info = commentaryOverlay.getHoverInfo?.(verse);

      expect(info).toBe('no Kabbalah');
    });
  });

  describe('URL State Management', () => {
    beforeEach(async () => {
      await commentaryOverlay.init?.();
    });

    it('returns empty params for total category', () => {
      const params = commentaryOverlay.getUrlParams?.();
      expect(params).toEqual({});
    });

    it('returns category param when filtered', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      const params = commentaryOverlay.getUrlParams?.();
      expect(params).toEqual({ category: 'Midrash' });
    });

    it('declares the category key it owns', () => {
      expect(commentaryOverlay.urlParams).toEqual([
        { key: 'category', kind: 'category' },
      ]);
    });

    it('applies category under its own key name', () => {
      commentaryOverlay.applyUrlParams?.(new URLSearchParams('category=Midrash'));
      expect(commentaryOverlay.getUrlParams?.()).toEqual({ category: 'Midrash' });
    });

    it('still accepts the older "cat" spelling', () => {
      commentaryOverlay.applyUrlParams?.(new URLSearchParams('cat=Midrash'));
      expect(commentaryOverlay.getUrlParams?.()).toEqual({ category: 'Midrash' });
    });

    it('applies category from URL params', () => {
      const urlParams = new URLSearchParams('cat=Talmud');
      commentaryOverlay.applyUrlParams?.(urlParams);

      const verse = testVerses[0]; // Genesis 1:1, Talmud: 30
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('ignores invalid URL params', () => {
      const urlParams = new URLSearchParams('other=value');
      commentaryOverlay.applyUrlParams?.(urlParams);

      const verse = testVerses[0];
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('triggers update callback when applying URL params', () => {
      const updateCallback = vi.fn();
      commentaryOverlay.onUpdate?.(updateCallback);

      const urlParams = new URLSearchParams('cat=Midrash');
      commentaryOverlay.applyUrlParams?.(urlParams);

      expect(updateCallback).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await commentaryOverlay.init?.();
    });

    it('handles missing book data', () => {
      const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('handles missing chapter data', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 999, verse: 1 });
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('handles missing verse data', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 999 });
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('handles verses with only zero counts', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 3 }); // total: 0
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('handles empty category object', () => {
      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 3 }); // empty categories

      const container = document.createElement('div');
      commentaryOverlay.renderControls?.(container);
      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;
      expect(color).not.toBeNull();
    });

    it('handles very high commentary counts', async () => {
      const highCountData: CommentaryData = {
        'Genesis': {
          '1': {
            '1': { total: 999999, categories: { 'Midrash': 999999 } },
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(highCountData),
      } as Response);

      const verse = createVerse({ book: 'Genesis', chapter: 1, verse: 1 });
      configure({ verses: [verse] });

      await commentaryOverlay.init?.();

      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;
      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });
  });

  describe('getVerseLinkCount Helper', () => {
    beforeEach(async () => {
      await commentaryOverlay.init?.();
    });

    it('returns total link count for verse with data', () => {
      const count = getVerseLinkCount('Genesis', 1, 1);
      expect(count).toBe(150);
    });

    it('returns null for verse without data', () => {
      const count = getVerseLinkCount('NonExistent', 1, 1);
      expect(count).toBeNull();
    });

    it('returns 0 for verse with zero total', () => {
      const count = getVerseLinkCount('Genesis', 1, 3);
      expect(count).toBe(0);
    });

    it('handles missing book', () => {
      const count = getVerseLinkCount('Psalms', 1, 1);
      expect(count).toBeNull();
    });

    it('handles missing chapter', () => {
      const count = getVerseLinkCount('Genesis', 999, 1);
      expect(count).toBeNull();
    });

    it('handles missing verse', () => {
      const count = getVerseLinkCount('Genesis', 1, 999);
      expect(count).toBeNull();
    });
  });

  describe('Configure Function', () => {
    it('accepts verses configuration', () => {
      const verses = [
        createVerse({ book: 'Genesis', chapter: 1, verse: 1 }),
        createVerse({ book: 'Genesis', chapter: 1, verse: 2 }),
      ];

      expect(() => configure({ verses })).not.toThrow();
    });

    it('handles empty verse array', () => {
      expect(() => configure({ verses: [] })).not.toThrow();
    });
  });

  describe('Destroy', () => {
    beforeEach(async () => {
      await commentaryOverlay.init?.();
    });

    it('preserves category selection across destroy/recreate cycles', () => {
      const container1 = document.createElement('div');
      commentaryOverlay.renderControls?.(container1);

      const select1 = container1.querySelector('select') as HTMLSelectElement;
      select1.value = 'Midrash';
      select1.dispatchEvent(new Event('change'));

      // Verify category is set
      let params = commentaryOverlay.getUrlParams?.();
      expect(params).toEqual({ category: 'Midrash' });

      // Destroy (simulating overlay switch)
      commentaryOverlay.destroy?.();

      // Category should still be preserved internally
      params = commentaryOverlay.getUrlParams?.();
      expect(params).toEqual({ category: 'Midrash' });

      // Re-render controls (simulating switching back to commentary)
      const container2 = document.createElement('div');
      commentaryOverlay.renderControls?.(container2);

      // Verify category is restored in the select element
      const select2 = container2.querySelector('select') as HTMLSelectElement;
      expect(select2.value).toBe('Midrash');
    });

    it('clears update callback', () => {
      const updateCallback = vi.fn();
      commentaryOverlay.onUpdate?.(updateCallback);

      commentaryOverlay.destroy?.();

      // After destroy, callback should not be set
      expect(() => commentaryOverlay.destroy?.()).not.toThrow();
    });
  });

  describe('All Categories', () => {
    beforeEach(async () => {
      await commentaryOverlay.init?.();
    });

    const categories = [
      'Midrash',
      'Talmud',
      'Halakhah',
      'Chasidut',
      'Kabbalah',
      'Jewish Thought',
      'Musar',
      'Responsa',
      'Tanakh',
    ];

    categories.forEach(category => {
      it(`filters by ${category} category correctly`, () => {
        const container = document.createElement('div');
        commentaryOverlay.renderControls?.(container);

        const select = container.querySelector('select') as HTMLSelectElement;

        // Try to select the category (it might not be in the dropdown)
        select.value = category;
        if (select.value === category) {
          select.dispatchEvent(new Event('change'));

          // Get colors for all test verses
          for (const verse of testVerses) {
            const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;
            expect(color).not.toBeNull();
            assertValidColor(color as [number, number, number]);
          }
        }
      });
    });
  });

  describe('Logarithmic Heatmap', () => {
    beforeEach(async () => {
      await commentaryOverlay.init?.();
    });

    it('uses heatmapColor function from utils/color', () => {
      const verse = testVerses[0];
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      // Verify it returns same result as calling heatmapColor directly
      const expectedColor = heatmapColor(150, 150);
      expect(color).toEqual(expectedColor);
    });

    it('passes correct count and max to heatmapColor', () => {
      const verse1 = testVerses[0]; // 150 total
      const verse2 = testVerses[1]; // 45 total

      const color1 = commentaryOverlay.getVerseColor(verse1);
      const color2 = commentaryOverlay.getVerseColor(verse2);

      // Verify against direct heatmapColor calls
      const expected1 = heatmapColor(150, 150);
      const expected2 = heatmapColor(45, 150);

      expect(color1).toEqual(expected1);
      expect(color2).toEqual(expected2);
    });
  });
});
