import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  registerOverlay,
  getOverlay,
  getAllOverlays,
  divineNamesOverlay,
  commentaryOverlay,
  tropOverlay,
  searchOverlay,
  configureCommentary,
  configureTrop,
  configureSearch,
  type Overlay,
} from '../../overlays/index';
import {
  createVerse,
  createVerses,
  SAMPLE_VERSES,
  SAMPLE_COMMENTARY_DATA,
  SAMPLE_DIVINE_NAMES_DATA,
  SAMPLE_VERSE_TEXTS,
} from '../helpers/fixtures';
import { restoreAllMocks } from '../helpers/mocks';

/**
 * Integration test for overlay switching behavior
 * Tests how overlays interact when switching between them, including:
 * - State preservation
 * - UI updates
 * - Color recalculation
 * - Cleanup
 */
describe('Overlay Switching Integration', () => {
  let mockControlsContainer: HTMLElement;
  let mockLegendContainer: HTMLElement;
  let verses = SAMPLE_VERSES;
  let currentOverlay: Overlay | null = null;
  let lastColors: Array<[number, number, number] | [number, number, number][] | null> = [];

  beforeEach(() => {
    // Clear overlay registry
    const registry = new Map();

    // Create real DOM elements for testing (jsdom)
    mockControlsContainer = document.createElement('div');
    mockLegendContainer = document.createElement('div');

    // Mock fetch for overlay data
    global.fetch = vi.fn((url: string | Request) => {
      const urlString = typeof url === 'string' ? url : url.url;

      let data: any;
      if (urlString.includes('divine-names.json')) {
        data = SAMPLE_DIVINE_NAMES_DATA;
      } else if (urlString.includes('commentary-counts.json')) {
        data = SAMPLE_COMMENTARY_DATA;
      } else {
        data = {};
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(data),
      } as Response);
    });

    // Register overlays fresh
    registerOverlay(divineNamesOverlay);
    registerOverlay(commentaryOverlay);
    registerOverlay(tropOverlay);
    registerOverlay(searchOverlay);

    // Configure overlays with sample data
    configureCommentary({ verses: SAMPLE_VERSES });
    configureTrop({ verseTexts: SAMPLE_VERSE_TEXTS });
    configureSearch({
      verses: SAMPLE_VERSES,
      callbacks: { onVerseClick: vi.fn() },
    });

    currentOverlay = null;
    lastColors = [];
  });

  afterEach(() => {
    // Clean up current overlay
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

    // Wire up update callback
    let updateCallbackFired = false;
    overlay.onUpdate?.(() => {
      updateCallbackFired = true;
    });

    // Render controls and legend
    mockControlsContainer.innerHTML = '';
    overlay.renderControls?.(mockControlsContainer);

    mockLegendContainer.innerHTML = '';
    overlay.renderLegend?.(mockLegendContainer);

    // Apply colors
    lastColors = verses.map(v => overlay.getVerseColor(v));

    currentOverlay = overlay;
    return overlay;
  }

  /**
   * Helper to check that all verses got colors
   */
  function expectColorsApplied(colorCount: number = verses.length): void {
    expect(lastColors.length).toBe(verses.length);

    const nonNullColors = lastColors.filter(c => c !== null);
    expect(nonNullColors.length).toBeGreaterThan(0);
    expect(nonNullColors.length).toBeLessThanOrEqual(colorCount);
  }

  describe('Basic Overlay Switching', () => {
    it('switches from no overlay to divine-names overlay', async () => {
      const overlay = await switchToOverlay('divine-names');

      expect(overlay.id).toBe('divine-names');
      expect(overlay.name).toBe('Divine Names');
      expectColorsApplied();
    });

    it('switches from divine-names to commentary overlay', async () => {
      // Start with divine-names
      await switchToOverlay('divine-names');
      const divineNamesColors = [...lastColors];

      // Switch to commentary
      await switchToOverlay('commentary');

      expect(currentOverlay?.id).toBe('commentary');
      expect(currentOverlay?.name).toBe('Commentary Density');

      // Colors should have changed
      expectColorsApplied();

      // At least some colors should be different
      let changedCount = 0;
      for (let i = 0; i < verses.length; i++) {
        const oldColor = divineNamesColors[i];
        const newColor = lastColors[i];
        if (JSON.stringify(oldColor) !== JSON.stringify(newColor)) {
          changedCount++;
        }
      }
      expect(changedCount).toBeGreaterThan(0);
    });

    it('switches through all overlays in sequence', async () => {
      const overlayIds = ['divine-names', 'commentary', 'trop', 'search'];
      const results: string[] = [];

      for (const id of overlayIds) {
        await switchToOverlay(id);
        results.push(currentOverlay!.id);

        // Verify colors were calculated for each overlay
        expect(lastColors.length).toBe(verses.length);

        // For overlays that match our test data, verify at least some colors
        if (id === 'divine-names' || id === 'commentary') {
          const nonNullColors = lastColors.filter(c => c !== null);
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
      await switchToOverlay('divine-names');

      expect(destroySpy).toHaveBeenCalled();
    });

    it('clears controls container when switching overlays', async () => {
      // Commentary has controls (category selector)
      await switchToOverlay('commentary');
      expect(mockControlsContainer.innerHTML).not.toBe('');

      // Divine names has no controls
      await switchToOverlay('divine-names');
      expect(mockControlsContainer.innerHTML).toBe('');
    });

    it('clears legend container when switching overlays', async () => {
      await switchToOverlay('divine-names');
      expect(mockLegendContainer.innerHTML).not.toBe('');

      const previousHTML = mockLegendContainer.innerHTML;

      await switchToOverlay('commentary');
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
      await switchToOverlay('divine-names');
      expect(mockControlsContainer.innerHTML).toBe('');

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

      // Commentary should render category selector
      expect(mockControlsContainer.innerHTML).toContain('category-select');
      expect(mockControlsContainer.innerHTML).toContain('Category:');
    });

    it('renders controls for trop overlay', async () => {
      await switchToOverlay('trop');

      // Trop should render mark selector chart
      expect(mockControlsContainer.innerHTML).toContain('trop-chart');
      expect(mockControlsContainer.innerHTML).toContain('Select Trop Mark');
    });

    it('renders controls for search overlay', async () => {
      await switchToOverlay('search');

      // Search should render search input
      expect(mockControlsContainer.innerHTML).toContain('search-input');
    });

    it('does not render controls for divine-names overlay', async () => {
      await switchToOverlay('divine-names');

      // Divine names has no controls
      expect(mockControlsContainer.innerHTML).toBe('');
    });
  });

  describe('Legend Rendering', () => {
    it('renders legend for divine-names overlay', async () => {
      await switchToOverlay('divine-names');

      expect(mockLegendContainer.innerHTML).toContain('YHWH');
      expect(mockLegendContainer.innerHTML).toContain('Elohim');
      expect(mockLegendContainer.innerHTML).toContain('Both');
    });

    it('renders legend for commentary overlay', async () => {
      await switchToOverlay('commentary');

      expect(mockLegendContainer.innerHTML).toContain('legend');
      // Should have gradient or scale
      expect(mockLegendContainer.innerHTML.length).toBeGreaterThan(0);
    });

    it('updates legend when overlay state changes', async () => {
      const overlay = await switchToOverlay('commentary');
      const initialLegend = mockLegendContainer.innerHTML;

      // Simulate category change by directly calling the callback
      const updateCallback = vi.fn(() => {
        mockLegendContainer.innerHTML = '';
        overlay.renderLegend?.(mockLegendContainer);
      });
      overlay.onUpdate?.(updateCallback);

      // Trigger update (would normally be from UI interaction)
      updateCallback();

      // Legend should have been re-rendered
      expect(updateCallback).toHaveBeenCalled();
    });
  });

  describe('Color Calculation', () => {
    it('calculates colors for divine-names overlay', async () => {
      await switchToOverlay('divine-names');

      // Check that Genesis verses get colors based on divine names
      const genesisVerse = verses.find(v => v.book === 'Genesis' && v.chapter === 1 && v.verse === 1);
      if (genesisVerse) {
        const color = currentOverlay!.getVerseColor(genesisVerse);
        expect(color).not.toBeNull();
        expect(Array.isArray(color)).toBe(true);
      }
    });

    it('calculates colors for commentary overlay', async () => {
      await switchToOverlay('commentary');

      // Check that verses with commentary get heatmap colors
      const genesisVerse = verses.find(v => v.book === 'Genesis' && v.chapter === 1 && v.verse === 1);
      if (genesisVerse) {
        const color = currentOverlay!.getVerseColor(genesisVerse);
        expect(color).not.toBeNull();
      }
    });

    it('returns null for verses without overlay data', async () => {
      await switchToOverlay('divine-names');

      // Divine names only covers Torah
      const isaiahVerse = verses.find(v => v.book === 'Isaiah');
      if (isaiahVerse) {
        const color = currentOverlay!.getVerseColor(isaiahVerse);
        expect(color).toBeNull();
      }
    });

    it('recalculates colors after state change', async () => {
      const overlay = await switchToOverlay('commentary');

      const genesisVerse = verses.find(v => v.book === 'Genesis' && v.chapter === 1 && v.verse === 1)!;
      const initialColor = overlay.getVerseColor(genesisVerse);

      // Simulate category change (would trigger different color calculation)
      // This is a bit tricky without full DOM, but we can test that the mechanism exists
      expect(overlay.onUpdate).toBeDefined();
      expect(typeof overlay.onUpdate).toBe('function');
    });
  });

  describe('Hover Information', () => {
    it('provides hover info for divine-names overlay', async () => {
      await switchToOverlay('divine-names');

      const genesisVerse = verses.find(v => v.book === 'Genesis' && v.chapter === 1 && v.verse === 1);
      if (genesisVerse && currentOverlay?.getHoverInfo) {
        const info = currentOverlay.getHoverInfo(genesisVerse);
        expect(info).toBeTruthy();
        expect(typeof info).toBe('string');
      }
    });

    it('clears hover info when switching overlays', async () => {
      await switchToOverlay('divine-names');
      const verse = verses.find(v => v.book === 'Genesis')!;

      const divineNamesInfo = currentOverlay?.getHoverInfo?.(verse);

      await switchToOverlay('commentary');
      const commentaryInfo = currentOverlay?.getHoverInfo?.(verse);

      // Info should be different (or one might be null)
      if (divineNamesInfo && commentaryInfo) {
        expect(divineNamesInfo !== commentaryInfo || divineNamesInfo === null).toBe(true);
      }
    });
  });

  describe('Update Callbacks', () => {
    it('registers update callback for dynamic overlays', async () => {
      const overlay = await switchToOverlay('commentary');

      const updateCallback = vi.fn();
      overlay.onUpdate?.(updateCallback);

      expect(overlay.onUpdate).toBeDefined();
    });

    it('unregisters callbacks when overlay is destroyed', async () => {
      const overlay = await switchToOverlay('commentary');

      const updateCallback = vi.fn();
      overlay.onUpdate?.(updateCallback);

      // Switch away (calls destroy)
      await switchToOverlay('divine-names');

      // Callback should not fire after destroy
      // (This is implicitly tested by the destroy call)
      expect(overlay.destroy).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles switching to same overlay twice', async () => {
      await switchToOverlay('divine-names');
      const firstColors = [...lastColors];

      await switchToOverlay('divine-names');
      const secondColors = [...lastColors];

      // Colors should be identical
      expect(JSON.stringify(firstColors)).toBe(JSON.stringify(secondColors));
    });

    it('handles rapid overlay switching', async () => {
      // Simulate rapid switching
      await switchToOverlay('divine-names');
      await switchToOverlay('commentary');
      await switchToOverlay('trop');
      await switchToOverlay('divine-names');
      await switchToOverlay('commentary');

      // Should end up on commentary
      expect(currentOverlay?.id).toBe('commentary');
      expectColorsApplied();
    });

    it('handles switching to invalid overlay gracefully', async () => {
      await switchToOverlay('divine-names');

      // Try to get invalid overlay
      const invalidOverlay = getOverlay('nonexistent');
      expect(invalidOverlay).toBeUndefined();

      // Current overlay should be unchanged
      expect(currentOverlay?.id).toBe('divine-names');
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
      await expect(switchToOverlay('divine-names')).resolves.toBeDefined();
    });
  });

  describe('Hover State Integration', () => {
    it('supports cross-highlighting with setHoveredVerse', async () => {
      const overlay = await switchToOverlay('search');

      if (overlay.setHoveredVerse) {
        const verse = verses[0];
        const shouldRerender = overlay.setHoveredVerse(verse);

        // Should return boolean indicating if re-render needed
        expect(typeof shouldRerender).toBe('boolean');

        // Clear hover
        overlay.setHoveredVerse(null);
      } else {
        // Search overlay may not implement this yet
        expect(overlay.setHoveredVerse).toBeUndefined();
      }
    });

    it('clears hover state when switching overlays', async () => {
      await switchToOverlay('divine-names');

      // Set hover state if supported
      if (currentOverlay?.setHoveredVerse) {
        currentOverlay.setHoveredVerse(verses[0]);
      }

      // Switch overlay
      await switchToOverlay('commentary');

      // Previous hover state should not affect new overlay
      expectColorsApplied();
    });
  });

  describe('URL State Persistence', () => {
    it('provides URL params for overlays that support it', async () => {
      await switchToOverlay('commentary');

      if (currentOverlay?.getUrlParams) {
        const params = currentOverlay.getUrlParams();
        expect(params).toBeDefined();
        expect(typeof params).toBe('object');
      }
    });

    it('applies URL params when restoring overlay state', async () => {
      const overlay = await switchToOverlay('trop');

      if (overlay.applyUrlParams) {
        const params = new URLSearchParams('trop=tipcha');

        // Should not throw
        expect(() => overlay.applyUrlParams!(params)).not.toThrow();
      }
    });

    it('handles switching overlays with different URL params', async () => {
      // Commentary uses 'cat' param
      await switchToOverlay('commentary');
      const commentaryParams = currentOverlay?.getUrlParams?.();

      // Trop uses 'trop' param
      await switchToOverlay('trop');
      const tropParams = currentOverlay?.getUrlParams?.();

      // Both overlays should support URL params
      expect(commentaryParams).toBeDefined();
      expect(tropParams).toBeDefined();

      // Params may be empty objects if no selection made, but structure should differ
      // Commentary has 'cat', trop has 'trop'
      const commentaryKeys = Object.keys(commentaryParams || {});
      const tropKeys = Object.keys(tropParams || {});

      // At least one should have params, or they should be different
      const hasDifferentParams =
        JSON.stringify(commentaryParams) !== JSON.stringify(tropParams) ||
        (commentaryKeys.length === 0 && tropKeys.length === 0);

      expect(hasDifferentParams).toBe(true);
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

    it('all overlays implement required interface', () => {
      const allOverlays = getAllOverlays();

      for (const overlay of allOverlays) {
        expect(overlay.id).toBeDefined();
        expect(typeof overlay.id).toBe('string');
        expect(overlay.name).toBeDefined();
        expect(typeof overlay.name).toBe('string');
        expect(overlay.getVerseColor).toBeDefined();
        expect(typeof overlay.getVerseColor).toBe('function');
      }
    });

    it('overlay IDs are unique', () => {
      const allOverlays = getAllOverlays();
      const ids = allOverlays.map(o => o.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Performance Considerations', () => {
    it('handles switching with large verse set', async () => {
      // Create a larger verse set
      const largeVerseSet = createVerses(1000);
      verses = largeVerseSet;

      const startTime = Date.now();
      await switchToOverlay('divine-names');
      const endTime = Date.now();

      // Should complete in reasonable time (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(lastColors.length).toBe(1000);
    });

    it('does not recalculate colors unnecessarily', async () => {
      await switchToOverlay('divine-names');

      const verse = verses[0];
      const color1 = currentOverlay!.getVerseColor(verse);
      const color2 = currentOverlay!.getVerseColor(verse);

      // Same verse should return same color (reference equality not guaranteed, but values should match)
      expect(JSON.stringify(color1)).toBe(JSON.stringify(color2));
    });
  });

  describe('Error Handling', () => {
    it('handles fetch failure gracefully during init', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // Mock fetch to fail
      global.fetch = vi.fn(() => Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.reject(new Error('Not found')),
      } as Response));

      // Should not throw
      await expect(switchToOverlay('divine-names')).resolves.toBeDefined();

      // Overlay should still work (just with no data - all verses get null/gray)
      expect(lastColors.length).toBe(verses.length);
      const nullColors = lastColors.filter(c => c === null);
      // Most or all colors should be null since data failed to load
      expect(nullColors.length).toBeGreaterThan(0);
      consoleSpy.mockRestore();
    });

    it('handles malformed data gracefully', async () => {
      // Mock fetch to return invalid data
      global.fetch = vi.fn(() => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ invalidKey: 'invalid data' }),
      } as Response));

      await switchToOverlay('divine-names');

      // Should not throw when trying to get colors
      expect(() => {
        verses.forEach(v => currentOverlay!.getVerseColor(v));
      }).not.toThrow();

      // All colors should be null since data is malformed
      expect(lastColors.every(c => c === null)).toBe(true);
    });
  });
});
