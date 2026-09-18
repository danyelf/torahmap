import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerAllOverlays, getOverlay } from '../../../overlays/index';
import { configure } from '../../../overlays/commentary';

// The registry is where overlays come from — populate it the way the app does.
registerAllOverlays();
const commentaryOverlay = hostOverlay(getOverlay('commentary')!);

import { createVerse } from '../../helpers/fixtures';
import { assertValidColor, assertColorEquals } from '../../helpers/assertions';
import { mockFetch as installMockFetch } from '../../helpers/mocks';
import type { CommentaryData, TanakhLayout } from '../../../types';
import { hostOverlay } from '../../helpers/overlayHost';

describe('Commentary Overlay', () => {
  let testData: CommentaryData;
  let testVerses: TanakhLayout[];
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    commentaryOverlay.restore({});

    testData = {
      'Genesis': {
        '1': {
          '1': {
            total: 150,
            categories: { 'Midrash': 50, 'Talmud': 30, 'Chasidut': 20, 'Tanakh': 50 },
          },
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

    mockFetch = installMockFetch({ '/data/overlays/commentary/counts.json': testData });

    configure({ verses: testVerses });
  });

  afterEach(() => {
    commentaryOverlay.destroy();
  });

  describe('Overlay Interface', () => {
    it('has correct id and name', () => {
      expect(commentaryOverlay.overlay.id).toBe('commentary');
      expect(commentaryOverlay.overlay.name).toBe('Commentary');
    });
  });

  describe('Initialization', () => {
    it('loads commentary data on init', async () => {
      await commentaryOverlay.overlay.init?.();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('data/overlays/commentary/counts.json'),
      );
    });

    it('handles fetch errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      // Should not throw
      await expect(commentaryOverlay.overlay.init?.()).resolves.not.toThrow();
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
      await expect(commentaryOverlay.overlay.init?.()).resolves.not.toThrow();
      consoleSpy.mockRestore();
    });
  });

  describe('Color Computation - Total Category', () => {
    beforeEach(async () => {
      await commentaryOverlay.overlay.init?.();
    });

    it('returns valid colors for verses with data', () => {
      const verse = testVerses[0]; // Genesis 1:1, total: 150
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('returns different colors for different commentary counts', () => {
      const highVerse = testVerses[0]; // Genesis 1:1, total: 150
      const lowVerse = testVerses[5]; // Exodus 1:2, total: 5

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
      await commentaryOverlay.overlay.init?.();
    });

    it('filters by Midrash category', () => {
      const container = commentaryOverlay.renderControls();

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
      const container = commentaryOverlay.renderControls();

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Talmud';
      select.dispatchEvent(new Event('change'));

      const verse = testVerses[4]; // Exodus 1:1, Talmud: 50
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('filters by Halakhah category', () => {
      const container = commentaryOverlay.renderControls();

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Halakhah';
      select.dispatchEvent(new Event('change'));

      const verse = testVerses[4]; // Exodus 1:1, Halakhah: 30
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('returns dark color for verses without the filtered category', () => {
      const container = commentaryOverlay.renderControls();

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Kabbalah';
      select.dispatchEvent(new Event('change'));

      const verse = testVerses[0]; // Genesis 1:1, no Kabbalah
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number];

      // Should be dark (zero value)
      expect(color[0]).toBeCloseTo(0.15, 1);
    });

    it('handles multiple category switches', () => {
      const container = commentaryOverlay.renderControls();

      const select = container.querySelector('select') as HTMLSelectElement;
      const verse = testVerses[0]; // Genesis 1:1

      // Switch to Midrash
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));
      const midrashColor = commentaryOverlay.getVerseColor(verse) as
        [number, number, number] | null;
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
      await commentaryOverlay.overlay.init?.();
    });

    it('produces consistent colors for same verses', () => {
      const verse = testVerses[0];

      const color1 = commentaryOverlay.getVerseColor(verse);
      const color2 = commentaryOverlay.getVerseColor(verse);

      expect(color1).toEqual(color2);
    });

    it('recalculates colors on category change', () => {
      const container = commentaryOverlay.renderControls();

      // Use verse 2 which has different relative values in total vs Midrash
      // Genesis 1:2: total 45 (max 150), Midrash 20 (max 50)
      const verse = testVerses[1];
      const totalColor = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      const midrashColor = commentaryOverlay.getVerseColor(verse) as
        [number, number, number] | null;

      // Colors should be different because relative positions differ
      // In total: 45/150 = 0.3, in Midrash: 20/50 = 0.4
      expect(totalColor).not.toEqual(midrashColor);
    });
  });

  describe('Render Controls', () => {
    beforeEach(async () => {
      await commentaryOverlay.overlay.init?.();
    });

    it('renders category selector', () => {
      const container = commentaryOverlay.renderControls();

      const select = container.querySelector('select');
      expect(select).not.toBeNull();
      expect(select?.id).toBe('category-select');
    });

    it('includes all category options', () => {
      const container = commentaryOverlay.renderControls();

      const select = container.querySelector('select') as HTMLSelectElement;
      const options = Array.from(select.options).map((opt) => opt.value);

      expect(options).toContain('total');
      expect(options).toContain('Talmud');
      expect(options).toContain('Midrash');
      expect(options).toContain('Halakhah');
      expect(options).toContain('Jewish Thought');
      expect(options).toContain('Chasidut');
      expect(options).toContain('Kabbalah');
      expect(options).toContain('Musar');
    });

    it('offers every category worth looking at', () => {
      // The menu and the generating script have drifted apart before: Responsa
      // was counted for months without ever appearing here, so nobody could
      // look at it.
      //
      // "Other" is the deliberate exception. It is the generator's catch-all
      // for a shelf we do not recognise, so that such a shelf shows up in the
      // regeneration output instead of vanishing. Today it holds Sefaria's
      // "Guides" — introductions to the Talmud — and it is a diagnostic for
      // whoever refreshes the data, not a lens anyone would choose.
      const container = commentaryOverlay.renderControls();

      const select = container.querySelector('select') as HTMLSelectElement;
      const options = Array.from(select.options).map((opt) => opt.value);

      expect(options).toEqual([
        'total',
        'Commentary',
        'Quoting Commentary',
        'Talmud',
        'Midrash',
        'Mishnah',
        'Tosefta',
        'Halakhah',
        'Responsa',
        'Jewish Thought',
        'Kabbalah',
        'Chasidut',
        'Musar',
        'Liturgy',
        'Second Temple',
      ]);
    });

    it('sets initial value to current category', () => {
      const container = commentaryOverlay.renderControls();

      const select = container.querySelector('select') as HTMLSelectElement;
      expect(select.value).toBe('total');
    });

    it('notifies the app when the category changes', () => {
      const container = commentaryOverlay.renderControls();

      const listener = vi.fn();
      commentaryOverlay.onChange(listener);

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('Render Legend', () => {
    beforeEach(async () => {
      await commentaryOverlay.overlay.init?.();
    });

    it('renders gradient element', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderLegend(container);

      const gradient = container.querySelector('.legend-gradient');
      expect(gradient).not.toBeNull();
    });

    it('renders tick marks', () => {
      const container = document.createElement('div');
      commentaryOverlay.renderLegend(container);

      const ticks = container.querySelector('.legend-ticks');
      expect(ticks).not.toBeNull();
    });

    // Read the labels, not the markup: `left: 100%` in a style attribute
    // satisfies a substring check for "100" whether or not that tick exists.
    const tickLabels = (container: HTMLElement) =>
      Array.from(container.querySelectorAll('.tick')).map((tick) => tick.textContent);

    async function reinitWithMax(total: number) {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 'Genesis': { '1': { '1': { total, categories: {} } } } }),
      } as Response);

      configure({ verses: [createVerse({ book: 'Genesis', chapter: 1, verse: 1 })] });
      await commentaryOverlay.overlay.init?.();

      const container = document.createElement('div');
      commentaryOverlay.renderLegend(container);
      return container;
    }

    it('ticks the powers of ten, then the maximum', async () => {
      expect(tickLabels(await reinitWithMax(900))).toEqual(['0', '1', '10', '100', '900']);
    });

    it('drops the last power of ten when the maximum sits on top of it', () => {
      // The fixture tops out at 150, which is 8% from 100 on the log scale.
      const container = document.createElement('div');
      commentaryOverlay.renderLegend(container);

      expect(tickLabels(container)).toEqual(['0', '1', '10', '150']);
    });

    it('writes a thousands separator rather than abbreviating', async () => {
      expect(tickLabels(await reinitWithMax(5000))).toContain('5,000');
    });
  });

  describe('Hover Info', () => {
    beforeEach(async () => {
      await commentaryOverlay.overlay.init?.();
    });

    it('returns link count for total category', () => {
      const verse = testVerses[0]; // Genesis 1:1, total: 150
      const info = commentaryOverlay.getHoverInfo(verse);

      expect(info).toBe('150 links');
    });

    it('returns category count when filtered', () => {
      const container = commentaryOverlay.renderControls();

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      const verse = testVerses[0]; // Genesis 1:1, Midrash: 50
      const info = commentaryOverlay.getHoverInfo(verse);

      expect(info).toBe('50 Midrash');
    });

    it('returns null for verses without data', () => {
      const verse = createVerse({ book: 'NonExistent', chapter: 1, verse: 1 });
      const info = commentaryOverlay.getHoverInfo(verse);

      expect(info).toBeNull();
    });

    it('returns "no <category>" for category with zero count', () => {
      const container = commentaryOverlay.renderControls();

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Kabbalah';
      select.dispatchEvent(new Event('change'));

      const verse = testVerses[0]; // Genesis 1:1, no Kabbalah
      const info = commentaryOverlay.getHoverInfo(verse);

      expect(info).toBe('no Kabbalah');
    });
  });

  describe('URL State Management', () => {
    beforeEach(async () => {
      await commentaryOverlay.overlay.init?.();
    });

    it('returns empty params for total category', () => {
      const params = commentaryOverlay.toUrl();
      expect(params).toEqual({});
    });

    it('returns category param when filtered', () => {
      const container = commentaryOverlay.renderControls();

      const select = container.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      const params = commentaryOverlay.toUrl();
      expect(params).toEqual({ category: 'Midrash' });
    });

    it('declares the category key it owns', () => {
      expect(commentaryOverlay.overlay.urlParams).toEqual([
        { key: 'category', kind: 'category', default: 'total' },
      ]);
    });

    it('applies category under its own key name', () => {
      commentaryOverlay.restore(new URLSearchParams('category=Midrash'));
      expect(commentaryOverlay.toUrl()).toEqual({ category: 'Midrash' });
    });

    it('applies category from URL params', () => {
      commentaryOverlay.restore(new URLSearchParams('category=Talmud'));

      const verse = testVerses[0]; // Genesis 1:1, Talmud: 30
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('ignores invalid URL params', () => {
      commentaryOverlay.restore(new URLSearchParams('other=value'));

      const verse = testVerses[0];
      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;

      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
    });

    it('restoring a category from a link repaints without announcing a change', () => {
      const listener = vi.fn();
      commentaryOverlay.onChange(listener);

      commentaryOverlay.restore(new URLSearchParams('category=Midrash'));

      expect(commentaryOverlay.toUrl()).toEqual({ category: 'Midrash' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await commentaryOverlay.overlay.init?.();
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

      const container = commentaryOverlay.renderControls();
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

      await commentaryOverlay.overlay.init?.();

      const color = commentaryOverlay.getVerseColor(verse) as [number, number, number] | null;
      expect(color).not.toBeNull();
      assertValidColor(color as [number, number, number]);
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
      await commentaryOverlay.overlay.init?.();
    });

    it('preserves category selection across destroy/recreate cycles', () => {
      const container1 = commentaryOverlay.renderControls();

      const select1 = container1.querySelector('select') as HTMLSelectElement;
      select1.value = 'Midrash';
      select1.dispatchEvent(new Event('change'));

      // Verify category is set
      let params = commentaryOverlay.toUrl();
      expect(params).toEqual({ category: 'Midrash' });

      // Destroy (simulating overlay switch)
      commentaryOverlay.destroy();

      // Category should still be preserved — it lives in the app's settings
      // store, not the overlay, so destroy does not touch it.
      params = commentaryOverlay.toUrl();
      expect(params).toEqual({ category: 'Midrash' });

      // Re-render controls (simulating switching back to commentary)
      const container2 = commentaryOverlay.renderControls();

      // Verify category is restored in the select element
      const select2 = container2.querySelector('select') as HTMLSelectElement;
      expect(select2.value).toBe('Midrash');
    });

    it('can be called again without throwing', () => {
      commentaryOverlay.destroy();
      expect(() => commentaryOverlay.destroy()).not.toThrow();
    });
  });

  describe('All Categories', () => {
    beforeEach(async () => {
      await commentaryOverlay.overlay.init?.();
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

    categories.forEach((category) => {
      it(`filters by ${category} category correctly`, () => {
        const container = commentaryOverlay.renderControls();

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
      await commentaryOverlay.overlay.init?.();
    });

    // The colours themselves, not "whatever the colour function returns" — an
    // assertion of the latter shape holds however the scale is wired up.
    it('colours a verse by where its count falls on the log scale', () => {
      const atMax = commentaryOverlay.getVerseColor(testVerses[0]); // 150 of 150
      const partWay = commentaryOverlay.getVerseColor(testVerses[1]); // 45 of 150

      assertColorEquals(atMax as number[], [1, 0.23, 0.18]);
      assertColorEquals(partWay as number[], [0.905236, 0.324764, 0.132618]);
    });

    it('gives a verse with no links the no-data grey', () => {
      const unlinked = createVerse({ book: 'Genesis', chapter: 1, verse: 3 }); // 0 total

      assertColorEquals(commentaryOverlay.getVerseColor(unlinked) as number[], [0.15, 0.15, 0.2]);
    });
  });

  describe('colorsFor', () => {
    beforeEach(async () => {
      await commentaryOverlay.overlay.init?.();
    });

    it('answers for settings it is handed without changing what it is showing', async () => {
      await commentaryOverlay.overlay.init?.();
      commentaryOverlay.restore({ category: 'Midrash' });

      const items = [{ book: 'Genesis', chapter: 1, verse: 1 }];

      // Asking about another category must not move the overlay off Midrash.
      commentaryOverlay.overlay.colorsFor!(
        items,
        commentaryOverlay.fromUrl({ category: 'total' }),
        null,
      );
      expect(commentaryOverlay.toUrl()).toEqual({ category: 'Midrash' });

      // And asking about the category it is on must agree with what it paints.
      expect(
        commentaryOverlay.overlay.colorsFor!(
          items,
          commentaryOverlay.fromUrl({ category: 'Midrash' }),
          null,
        ),
      ).toEqual([commentaryOverlay.getVerseColor(items[0])]);
    });
  });
});
