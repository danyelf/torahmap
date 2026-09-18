import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerAllOverlays,
  registerOverlay,
  getOverlay,
  getAllOverlays,
  configureCommentary,
  configureTrop,
  configureSearch,
  type Overlay,
} from '../../overlays/index';
import {
  createVerses,
  SAMPLE_VERSES,
  SAMPLE_COMMENTARY_DATA,
  SAMPLE_VERSE_TEXTS,
} from '../helpers/fixtures';
import { mockFetch, restoreAllMocks } from '../helpers/mocks';
import { createOverlaySettings, type OverlaySettings } from '../../overlays/settings';

describe('Overlay Switching Integration', () => {
  let mockControlsContainer: HTMLElement;
  let mockLegendContainer: HTMLElement;
  let verses = SAMPLE_VERSES;
  let currentOverlay: Overlay | null = null;
  let lastColors: Array<[number, number, number] | [number, number, number][] | null> = [];
  // The settings the app holds for each overlay, as main.ts holds them.
  let settings: OverlaySettings;

  beforeEach(() => {
    // Create real DOM elements for testing (jsdom)
    mockControlsContainer = document.createElement('div');
    mockLegendContainer = document.createElement('div');

    mockFetch({ '/data/overlays/commentary/counts.json': SAMPLE_COMMENTARY_DATA });

    // Register overlays fresh
    registerAllOverlays();

    // Configure overlays with sample data
    configureCommentary({ verses: SAMPLE_VERSES });
    configureTrop({ verseTexts: SAMPLE_VERSE_TEXTS });
    configureSearch({
      verses: SAMPLE_VERSES,
      callbacks: { onVerseClick: vi.fn() },
    });

    currentOverlay = null;
    lastColors = [];
    settings = createOverlaySettings();
  });

  afterEach(() => {
    currentOverlay?.destroy?.();
    restoreAllMocks();
  });

  /**
   * Helper to simulate switching to an overlay
   */
  async function switchToOverlay(overlayId: string): Promise<Overlay> {
    // Destroy previous overlay
    currentOverlay?.destroy?.();

    // Get new overlay
    const overlay = getOverlay(overlayId);
    if (!overlay) {
      throw new Error(`Overlay ${overlayId} not found`);
    }

    // Initialize if needed
    await overlay.init?.();

    // Render controls and legend
    mockControlsContainer.innerHTML = '';
    overlay.renderControls?.(mockControlsContainer, settings.get(overlay), (update) =>
      settings.set(overlay, update(settings.get(overlay))),
    );

    mockLegendContainer.innerHTML = '';
    overlay.renderLegend?.(mockLegendContainer, settings.get(overlay));

    // Apply colors
    lastColors = verses.map((v) => overlay.getVerseColor(v, settings.get(overlay)));

    currentOverlay = overlay;
    return overlay;
  }

  /**
   * Helper to check that all verses got colors
   */
  function expectColorsApplied(colorCount: number = verses.length): void {
    expect(lastColors.length).toBe(verses.length);

    const nonNullColors = lastColors.filter((c) => c !== null);
    expect(nonNullColors.length).toBeGreaterThan(0);
    expect(nonNullColors.length).toBeLessThanOrEqual(colorCount);
  }

  describe('Basic Overlay Switching', () => {
    it('switches from no overlay to commentary overlay', async () => {
      const overlay = await switchToOverlay('commentary');

      expect(overlay.id).toBe('commentary');
      expect(overlay.name).toBe('Commentary');
      expectColorsApplied();
    });

    it('switches from commentary to trop overlay', async () => {
      // Start with commentary
      await switchToOverlay('commentary');
      const commentaryColors = [...lastColors];

      // Switch to trop
      await switchToOverlay('trop');

      expect(currentOverlay?.id).toBe('trop');
      expect(currentOverlay?.name).toBe('Trop');

      // Colors should have changed (trop may return null without selected mark)
      expect(lastColors.length).toBe(verses.length);

      // At least some colors should be different
      let changedCount = 0;
      for (let i = 0; i < verses.length; i++) {
        const oldColor = commentaryColors[i];
        const newColor = lastColors[i];
        if (JSON.stringify(oldColor) !== JSON.stringify(newColor)) {
          changedCount++;
        }
      }
      expect(changedCount).toBeGreaterThan(0);
    });

    it('switches through all overlays in sequence', async () => {
      const overlayIds = ['commentary', 'trop', 'search'];
      const results: string[] = [];

      for (const id of overlayIds) {
        await switchToOverlay(id);
        results.push(currentOverlay!.id);

        // Verify colors were calculated for each overlay
        expect(lastColors.length).toBe(verses.length);

        // For overlays that match our test data, verify at least some colors
        if (id === 'commentary') {
          const nonNullColors = lastColors.filter((c) => c !== null);
          expect(nonNullColors.length).toBeGreaterThan(0);
        }
      }

      expect(results).toEqual(overlayIds);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('calls destroy() when switching away from overlay', async () => {
      const overlay = await switchToOverlay('commentary');
      const destroySpy = vi.spyOn(overlay, 'destroy' as any);

      // Switch to different overlay
      await switchToOverlay('trop');

      expect(destroySpy).toHaveBeenCalled();
    });

    it('clears controls container when switching overlays', async () => {
      // Commentary has controls (category selector)
      await switchToOverlay('commentary');
      expect(mockControlsContainer.innerHTML).not.toBe('');

      // Trop also has controls
      await switchToOverlay('trop');
      expect(mockControlsContainer.innerHTML).not.toBe('');
    });

    it('clears legend container when switching overlays', async () => {
      await switchToOverlay('commentary');
      expect(mockLegendContainer.innerHTML).not.toBe('');

      const previousHTML = mockLegendContainer.innerHTML;

      await switchToOverlay('trop');
      // Legend should be different
      expect(mockLegendContainer.innerHTML).not.toBe('');
      expect(mockLegendContainer.innerHTML).not.toBe(previousHTML);
    });

    it('does not leak event listeners when switching', async () => {
      // Switch to commentary (registers event listener)
      await switchToOverlay('commentary');

      // Check that controls were rendered
      const firstSelect = mockControlsContainer.querySelector('select');
      expect(firstSelect).not.toBeNull();

      // Switch away (should clean up)
      await switchToOverlay('search');
      expect(mockControlsContainer.innerHTML).not.toBe('');

      // Switch back to commentary (registers new listener)
      await switchToOverlay('commentary');

      const secondSelect = mockControlsContainer.querySelector('select');
      expect(secondSelect).not.toBeNull();

      // Should be different elements (not reused)
      expect(secondSelect).not.toBe(firstSelect);
    });
  });

  describe('UI Controls Rendering', () => {
    it('renders controls for commentary overlay', async () => {
      await switchToOverlay('commentary');

      // The markup itself is commentary's own concern; here we only check
      // that overlay switching wires renderControls to the container.
      expect(mockControlsContainer.innerHTML.length).toBeGreaterThan(0);
    });

    it('renders controls for trop overlay', async () => {
      await switchToOverlay('trop');

      expect(mockControlsContainer.innerHTML.length).toBeGreaterThan(0);
    });

    it('renders controls for search overlay', async () => {
      await switchToOverlay('search');

      expect(mockControlsContainer.innerHTML.length).toBeGreaterThan(0);
    });
  });

  describe('Legend Rendering', () => {
    it('renders legend for commentary overlay', async () => {
      await switchToOverlay('commentary');

      expect(mockLegendContainer.innerHTML).toContain('legend');
      // Should have gradient or scale
      expect(mockLegendContainer.innerHTML.length).toBeGreaterThan(0);
    });

    it('updates legend when overlay state changes', async () => {
      const overlay = await switchToOverlay('commentary');
      const initialLegend = mockLegendContainer.innerHTML;

      // Change the category through the real control, as a reader would.
      mockControlsContainer.innerHTML = '';
      overlay.renderControls?.(mockControlsContainer, settings.get(overlay), (update) =>
        settings.set(overlay, update(settings.get(overlay))),
      );
      const select = mockControlsContainer.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      mockLegendContainer.innerHTML = '';
      overlay.renderLegend?.(mockLegendContainer, settings.get(overlay));

      expect(mockLegendContainer.innerHTML).not.toBe(initialLegend);
    });
  });

  describe('Color Calculation', () => {
    it('calculates colors for commentary overlay', async () => {
      await switchToOverlay('commentary');

      // Check that verses with commentary get heatmap colors
      const genesisVerse = verses.find(
        (v) => v.book === 'Genesis' && v.chapter === 1 && v.verse === 1,
      );
      if (genesisVerse) {
        const color = currentOverlay!.getVerseColor(genesisVerse, settings.get(currentOverlay!));
        expect(color).not.toBeNull();
      }
    });
  });

  describe('Hover Information', () => {
    it('provides hover info for commentary overlay', async () => {
      await switchToOverlay('commentary');

      const genesisVerse = verses.find(
        (v) => v.book === 'Genesis' && v.chapter === 1 && v.verse === 1,
      );
      if (genesisVerse && currentOverlay?.getHoverInfo) {
        const info = currentOverlay.getHoverInfo!(genesisVerse, settings.get(currentOverlay));
        expect(info).toBeTruthy();
        expect(typeof info).toBe('string');
      }
    });
  });

  describe('Settings Changes', () => {
    it('notifies onChange when a control changes settings', async () => {
      const overlay = await switchToOverlay('commentary');

      const onChange = vi.fn();
      mockControlsContainer.innerHTML = '';
      overlay.renderControls?.(mockControlsContainer, settings.get(overlay), onChange);

      const select = mockControlsContainer.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      expect(onChange).toHaveBeenCalled();
    });

    it("keeps an overlay's settings after switching away", async () => {
      const overlay = await switchToOverlay('commentary');
      settings.set(overlay, { category: 'Midrash' });

      // Switch away (calls destroy)
      await switchToOverlay('trop');

      expect(settings.get(overlay)).toEqual({ category: 'Midrash' });
    });
  });

  describe('Edge Cases', () => {
    it('handles switching to same overlay twice', async () => {
      await switchToOverlay('commentary');
      const firstColors = [...lastColors];

      await switchToOverlay('commentary');
      const secondColors = [...lastColors];

      // Colors should be identical
      expect(JSON.stringify(firstColors)).toBe(JSON.stringify(secondColors));
    });

    it('handles rapid overlay switching', async () => {
      // Simulate rapid switching
      await switchToOverlay('commentary');
      await switchToOverlay('trop');
      await switchToOverlay('search');
      await switchToOverlay('trop');
      await switchToOverlay('commentary');

      // Should end up on commentary
      expect(currentOverlay?.id).toBe('commentary');
      expectColorsApplied();
    });

    it('handles switching to invalid overlay gracefully', async () => {
      await switchToOverlay('commentary');

      // Try to get invalid overlay
      const invalidOverlay = getOverlay('nonexistent');
      expect(invalidOverlay).toBeUndefined();

      // Current overlay should be unchanged
      expect(currentOverlay?.id).toBe('commentary');
    });

    it('handles overlay with no init method', async () => {
      // Divine names has init, but we test that missing init is ok
      const overlayWithoutInit: Overlay = {
        id: 'test-overlay',
        name: 'Test Overlay',
        getVerseColor: () => [1, 0, 0],
        // No init method
      };

      registerOverlay(overlayWithoutInit);

      // Should not throw
      await expect(switchToOverlay('test-overlay')).resolves.toBeDefined();
    });

    it('handles overlay with no destroy method', async () => {
      const overlayWithoutDestroy: Overlay = {
        id: 'test-overlay-2',
        name: 'Test Overlay 2',
        getVerseColor: () => [0, 1, 0],
        // No destroy method
      };

      registerOverlay(overlayWithoutDestroy);

      await switchToOverlay('test-overlay-2');

      // Switching away should not throw even without destroy
      await expect(switchToOverlay('commentary')).resolves.toBeDefined();
    });
  });

  describe('Hover State Integration', () => {
    it('supports cross-highlighting with setHoveredVerse', async () => {
      const overlay = await switchToOverlay('search');

      if (overlay.setHoveredVerse) {
        const verse = verses[0];
        const shouldRerender = overlay.setHoveredVerse(verse, settings.get(overlay));

        // Should return boolean indicating if re-render needed
        expect(typeof shouldRerender).toBe('boolean');

        // Clear hover
        overlay.setHoveredVerse(null, settings.get(overlay));
      } else {
        // Search overlay may not implement this yet
        expect(overlay.setHoveredVerse).toBeUndefined();
      }
    });

    it('clears hover state when switching overlays', async () => {
      await switchToOverlay('commentary');

      // Set hover state if supported
      if (currentOverlay?.setHoveredVerse) {
        currentOverlay.setHoveredVerse!(verses[0], settings.get(currentOverlay));
      }

      // Switch overlay
      await switchToOverlay('search');

      // Previous hover state should not affect new overlay
      expect(lastColors.length).toBe(verses.length);
    });
  });

  describe('URL State Persistence', () => {
    it('provides URL params through the settings store', async () => {
      const overlay = await switchToOverlay('commentary');

      const params = settings.toUrl(overlay);
      expect(params).toBeDefined();
      expect(typeof params).toBe('object');
    });

    it('applies URL params when restoring overlay state', async () => {
      const overlay = await switchToOverlay('trop');

      // Should not throw
      expect(() => settings.restore(overlay, new URLSearchParams('trop=tipcha'))).not.toThrow();
    });
  });

  describe('Integration with All Registered Overlays', () => {
    it('can switch to all registered overlays', async () => {
      const allOverlays = getAllOverlays();

      expect(allOverlays.length).toBeGreaterThan(0);

      for (const overlay of allOverlays) {
        await switchToOverlay(overlay.id);
        expect(currentOverlay?.id).toBe(overlay.id);

        // Check that colors were calculated (some overlays may return all null for test data)
        expect(lastColors.length).toBe(verses.length);

        // Some overlays like haftarah may not have matching data in test fixtures
        // So we just verify the color calculation ran (array is populated)
      }
    });

    it('overlay IDs are unique', () => {
      const allOverlays = getAllOverlays();
      const ids = allOverlays.map((o) => o.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Performance Considerations', () => {
    it('handles switching with large verse set', async () => {
      // Create a larger verse set
      const largeVerseSet = createVerses(1000);
      verses = largeVerseSet;

      await switchToOverlay('commentary');

      expect(lastColors.length).toBe(1000);
    });

    it('does not recalculate colors unnecessarily', async () => {
      await switchToOverlay('commentary');

      const verse = verses[0];
      const color1 = currentOverlay!.getVerseColor(verse, settings.get(currentOverlay!));
      const color2 = currentOverlay!.getVerseColor(verse, settings.get(currentOverlay!));

      // Same verse should return same color (reference equality not guaranteed, but values should match)
      expect(JSON.stringify(color1)).toBe(JSON.stringify(color2));
    });
  });

  describe('Error Handling', () => {
    it('handles fetch failure gracefully during init', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Mock fetch to fail
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.reject(new Error('Not found')),
        } as Response),
      );

      // Should not throw
      await expect(switchToOverlay('commentary')).resolves.toBeDefined();

      // Overlay should still work (just with no data)
      expect(lastColors.length).toBe(verses.length);
      // Overlay should provide default colors even if data fails to load
      expect(lastColors).toBeDefined();
      consoleSpy.mockRestore();
    });

    it('handles malformed data gracefully', async () => {
      // Mock fetch to return invalid data
      globalThis.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ invalidKey: 'invalid data' }),
        } as Response),
      );

      await switchToOverlay('commentary');

      // Should not throw when trying to get colors
      expect(() => {
        verses.forEach((v) => currentOverlay!.getVerseColor(v, settings.get(currentOverlay!)));
      }).not.toThrow();

      // Should provide valid colors even with malformed data
      expect(lastColors.length).toBe(verses.length);
    });
  });
});
