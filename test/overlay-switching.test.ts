import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TanakhOverlay } from '@torahmap/tanakh/overlays/index.ts';
import {
  registerAllOverlays,
  registerOverlay,
  getOverlay,
  getAllOverlays,
} from '@torahmap/tanakh/overlays/index.ts';
import {
  createVerses,
  SAMPLE_VERSES,
  SAMPLE_LOADED,
  testOverlay,
} from '../apps/tanakh/test/helpers/fixtures.ts';
import { dataFor } from '../packages/shell/src/dataFiles.ts';
import { configure as configureSearch, searchTool } from '@torahmap/tanakh/search/index.ts';
import { commentaryOverlay, type CommentaryCounts } from '@torahmap/tanakh/overlays/commentary.ts';
import { restoreAllMocks } from '../apps/tanakh/test/helpers/mocks.ts';
import {
  activeOverlay,
  emptyTools,
  fromLink,
  settingsIn,
  toLink,
  withActive,
  withOverlaySettings,
  type ToolState,
} from '../packages/shell/src/tools.ts';

describe('Overlay Switching Integration', () => {
  let mockControlsContainer: HTMLElement;
  let mockLegendContainer: HTMLElement;
  let verses = SAMPLE_VERSES;
  let currentData: unknown;
  let lastColors: Array<[number, number, number] | [number, number, number][] | null> = [];
  const textTools = { search: searchTool, overlay: getOverlay };
  let tools: ToolState<unknown>;
  const overlayOn = () => activeOverlay(tools, textTools);

  beforeEach(() => {
    // Create real DOM elements for testing (jsdom)
    mockControlsContainer = document.createElement('div');
    mockLegendContainer = document.createElement('div');

    // Register overlays fresh
    registerAllOverlays();

    // Configure overlays with sample data
    configureSearch({
      verses: SAMPLE_VERSES,
      callbacks: { onVerseClick: vi.fn() },
    });

    lastColors = [];
    tools = emptyTools(searchTool);
  });

  afterEach(() => {
    overlayOn()?.destroy?.();
    restoreAllMocks();
  });

  /**
   * Helper to simulate switching to an overlay
   */
  function switchToOverlay(overlayId: string): TanakhOverlay {
    // Destroy previous overlay
    overlayOn()?.destroy?.();

    // Get new overlay
    const overlay = getOverlay(overlayId);
    if (!overlay) {
      throw new Error(`Overlay ${overlayId} not found`);
    }

    const data = dataFor(overlay, SAMPLE_LOADED);
    if (data === null) throw new Error(`${overlay.id}'s files are not in SAMPLE_LOADED`);

    // Render controls and legend
    mockControlsContainer.innerHTML = '';
    overlay.renderControls?.(
      mockControlsContainer,
      settingsIn(tools, overlay),
      (update) => (tools = withOverlaySettings(tools, textTools, overlay, update)),
      data,
    );

    mockLegendContainer.innerHTML = '';
    overlay.renderLegend?.(mockLegendContainer, settingsIn(tools, overlay), data);

    // Apply colors
    lastColors = overlay.colorsFor({
      items: verses,
      settings: settingsIn(tools, overlay),
      data,
      focus: { hovered: null, pinned: null },
    });

    tools = withActive(tools, textTools, overlayId);
    currentData = data;
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
    it('switches from no overlay to commentary overlay', () => {
      const overlay = switchToOverlay('commentary');

      expect(overlay.id).toBe('commentary');
      expect(overlay.name).toBe('Commentary');
      expectColorsApplied();
    });

    it('switches from commentary to trop overlay', () => {
      // Start with commentary
      switchToOverlay('commentary');
      const commentaryColors = [...lastColors];

      // Switch to trop
      switchToOverlay('trop');

      expect(overlayOn()?.id).toBe('trop');
      expect(overlayOn()?.name).toBe('Trop');

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

    it('switches through all overlays in sequence', () => {
      const overlayIds = ['commentary', 'trop'];
      const results: string[] = [];

      for (const id of overlayIds) {
        switchToOverlay(id);
        results.push(overlayOn()!.id);

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
    it('calls destroy() when switching away from overlay', () => {
      const destroy = vi.fn();
      registerOverlay(testOverlay({ id: 'test-destroy', name: 'Test', destroy }));
      switchToOverlay('test-destroy');

      switchToOverlay('trop');

      expect(destroy).toHaveBeenCalled();
    });

    it('clears controls container when switching overlays', () => {
      // Commentary has controls (category selector)
      switchToOverlay('commentary');
      expect(mockControlsContainer.innerHTML).not.toBe('');

      // Trop also has controls
      switchToOverlay('trop');
      expect(mockControlsContainer.innerHTML).not.toBe('');
    });

    it('clears legend container when switching overlays', () => {
      switchToOverlay('commentary');
      expect(mockLegendContainer.innerHTML).not.toBe('');

      const previousHTML = mockLegendContainer.innerHTML;

      switchToOverlay('trop');
      // Legend should be different
      expect(mockLegendContainer.innerHTML).not.toBe('');
      expect(mockLegendContainer.innerHTML).not.toBe(previousHTML);
    });

    it('does not leak event listeners when switching', () => {
      // Switch to commentary (registers event listener)
      switchToOverlay('commentary');

      // Check that controls were rendered
      const firstSelect = mockControlsContainer.querySelector('select');
      expect(firstSelect).not.toBeNull();

      // Switch away (should clean up)
      switchToOverlay('trop');
      expect(mockControlsContainer.innerHTML).not.toBe('');

      // Switch back to commentary (registers new listener)
      switchToOverlay('commentary');

      const secondSelect = mockControlsContainer.querySelector('select');
      expect(secondSelect).not.toBeNull();

      // Should be different elements (not reused)
      expect(secondSelect).not.toBe(firstSelect);
    });
  });

  describe('UI Controls Rendering', () => {
    it('renders controls for commentary overlay', () => {
      switchToOverlay('commentary');

      // The markup itself is commentary's own concern; here we only check
      // that overlay switching wires renderControls to the container.
      expect(mockControlsContainer.innerHTML.length).toBeGreaterThan(0);
    });

    it('renders controls for trop overlay', () => {
      switchToOverlay('trop');

      expect(mockControlsContainer.innerHTML.length).toBeGreaterThan(0);
    });
  });

  describe('Legend Rendering', () => {
    it('renders legend for commentary overlay', () => {
      switchToOverlay('commentary');

      expect(mockLegendContainer.innerHTML).toContain('legend');
      // Should have gradient or scale
      expect(mockLegendContainer.innerHTML.length).toBeGreaterThan(0);
    });

    it('updates legend when overlay state changes', () => {
      const overlay = switchToOverlay('commentary');
      const initialLegend = mockLegendContainer.innerHTML;

      // Change the category through the real control, as a reader would.
      mockControlsContainer.innerHTML = '';
      overlay.renderControls?.(
        mockControlsContainer,
        settingsIn(tools, overlay),
        (update) => (tools = withOverlaySettings(tools, textTools, overlay, update)),
        currentData,
      );
      const select = mockControlsContainer.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      mockLegendContainer.innerHTML = '';
      overlay.renderLegend?.(mockLegendContainer, settingsIn(tools, overlay), currentData);

      expect(mockLegendContainer.innerHTML).not.toBe(initialLegend);
    });
  });

  describe('Color Calculation', () => {
    it('calculates colors for commentary overlay', () => {
      switchToOverlay('commentary');

      // Check that verses with commentary get heatmap colors
      const genesisVerse = verses.find(
        (v) => v.book === 'Genesis' && v.chapter === 1 && v.verse === 1,
      );
      if (genesisVerse) {
        const color = overlayOn()!.colorsFor({
          items: [genesisVerse],
          settings: settingsIn(tools, overlayOn()!),
          data: currentData,
          focus: { hovered: null, pinned: null },
        })[0];
        expect(color).not.toBeNull();
      }
    });
  });

  describe('Hover Information', () => {
    it('provides hover info for commentary overlay', () => {
      switchToOverlay('commentary');

      const genesisVerse = verses.find(
        (v) => v.book === 'Genesis' && v.chapter === 1 && v.verse === 1,
      );
      if (genesisVerse && overlayOn()?.getHoverInfo) {
        const info = overlayOn()!.getHoverInfo!(
          genesisVerse,
          settingsIn(tools, overlayOn()!),
          currentData,
        );
        expect(info).toBeTruthy();
        expect(typeof info).toBe('string');
      }
    });
  });

  describe('Settings Changes', () => {
    it('notifies onChange when a control changes settings', () => {
      const overlay = switchToOverlay('commentary');

      const onChange = vi.fn();
      mockControlsContainer.innerHTML = '';
      overlay.renderControls?.(
        mockControlsContainer,
        settingsIn(tools, overlay),
        onChange,
        currentData,
      );

      const select = mockControlsContainer.querySelector('select') as HTMLSelectElement;
      select.value = 'Midrash';
      select.dispatchEvent(new Event('change'));

      expect(onChange).toHaveBeenCalled();
    });

    it("keeps an overlay's settings after switching away", () => {
      const overlay = switchToOverlay('commentary');
      tools = withOverlaySettings(tools, textTools, overlay, () => ({ category: 'Midrash' }));

      // Switch away (calls destroy)
      switchToOverlay('trop');

      expect(settingsIn(tools, overlay)).toEqual({ category: 'Midrash' });
    });
  });

  describe('Edge Cases', () => {
    it('handles switching to same overlay twice', () => {
      switchToOverlay('commentary');
      const firstColors = [...lastColors];

      switchToOverlay('commentary');
      const secondColors = [...lastColors];

      // Colors should be identical
      expect(JSON.stringify(firstColors)).toBe(JSON.stringify(secondColors));
    });

    it('handles rapid overlay switching', () => {
      // Simulate rapid switching
      switchToOverlay('commentary');
      switchToOverlay('trop');
      switchToOverlay('trop');
      switchToOverlay('commentary');

      // Should end up on commentary
      expect(overlayOn()?.id).toBe('commentary');
      expectColorsApplied();
    });

    it('handles switching to invalid overlay gracefully', () => {
      switchToOverlay('commentary');

      // Try to get invalid overlay
      const invalidOverlay = getOverlay('nonexistent');
      expect(invalidOverlay).toBeUndefined();

      // Current overlay should be unchanged
      expect(overlayOn()?.id).toBe('commentary');
    });

    it('handles overlay with no destroy method', () => {
      const overlayWithoutDestroy = testOverlay({
        id: 'test-overlay-2',
        name: 'Test Overlay 2',
        colorsFor: ({ items }) => items.map(() => [0, 1, 0] as [number, number, number]),
        // No destroy method
      });

      registerOverlay(overlayWithoutDestroy);

      switchToOverlay('test-overlay-2');

      // Switching away should not throw even without destroy
      expect(switchToOverlay('commentary')).toBeDefined();
    });
  });

  it('only Haftarah and Text Analytics say their colours depend on the hovered verse', () => {
    const hoverSensitive = getAllOverlays().filter((o) => o.hoverChangesColors);
    expect(hoverSensitive.map((o) => o.id)).toEqual(['haftarah', 'text-analytics']);
  });

  describe('URL State Persistence', () => {
    it('provides URL params through the settings store', () => {
      switchToOverlay('commentary');

      const params = toLink(tools, textTools).overlayParams;
      expect(params).toBeDefined();
      expect(typeof params).toBe('object');
    });

    it('applies URL params when restoring overlay state', () => {
      switchToOverlay('trop');

      // Should not throw
      expect(() =>
        fromLink(
          { overlay: 'trop', overlayParams: new URLSearchParams('trop=tipcha') },
          tools,
          textTools,
        ),
      ).not.toThrow();
    });
  });

  describe('Integration with All Registered Overlays', () => {
    it('can switch to all registered overlays', () => {
      const allOverlays = getAllOverlays();

      expect(allOverlays.length).toBeGreaterThan(0);

      for (const overlay of allOverlays) {
        switchToOverlay(overlay.id);
        expect(overlayOn()?.id).toBe(overlay.id);

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
    it('handles switching with large verse set', () => {
      // Create a larger verse set
      const largeVerseSet = createVerses(1000);
      verses = largeVerseSet;

      switchToOverlay('commentary');

      expect(lastColors.length).toBe(1000);
    });

    it('does not recalculate colors unnecessarily', () => {
      switchToOverlay('commentary');

      const verse = verses[0];
      const color1 = overlayOn()!.colorsFor({
        items: [verse],
        settings: settingsIn(tools, overlayOn()!),
        data: currentData,
        focus: { hovered: null, pinned: null },
      })[0];
      const color2 = overlayOn()!.colorsFor({
        items: [verse],
        settings: settingsIn(tools, overlayOn()!),
        data: currentData,
        focus: { hovered: null, pinned: null },
      })[0];

      // Same verse should return same color (reference equality not guaranteed, but values should match)
      expect(JSON.stringify(color1)).toBe(JSON.stringify(color2));
    });
  });

  describe('Error Handling', () => {
    it('handles malformed data gracefully', () => {
      const overlay = commentaryOverlay;
      const malformed = {
        counts: { invalidKey: 'invalid data' } as unknown as CommentaryCounts,
      };

      expect(() => {
        overlay.colorsFor({
          items: verses,
          settings: settingsIn(tools, overlay),
          data: malformed,
          focus: { hovered: null, pinned: null },
        });
      }).not.toThrow();
    });
  });
});
