import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getDefaultColor, overlayColorsFor, layerToRecompute } from '../../itemColoring';
import type { Overlay } from '../../overlays/types';
import * as randomModule from '../../utils/random';
import { createVerse, testOverlay } from '../helpers/fixtures';

describe('itemColoring', () => {
  describe('getDefaultColor', () => {
    beforeEach(() => {
      // Mock seededRandom to return predictable values
      vi.spyOn(randomModule, 'seededRandom').mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns gray color with brightness variation', () => {
      const color = getDefaultColor(0);

      // With random = 0.5, brightness = 0.4 + 0.5 * 0.4 = 0.6
      expect(color[0]).toBeCloseTo(0.6, 10);
      expect(color[1]).toBeCloseTo(0.6, 10);
      expect(color[2]).toBeCloseTo(0.6, 10);
    });

    it('uses seeded random based on verse index', () => {
      getDefaultColor(5);

      expect(randomModule.seededRandom).toHaveBeenCalledWith(15); // 5 * 3
    });

    it('returns brightness within expected range', () => {
      // Test with different random values
      vi.spyOn(randomModule, 'seededRandom').mockReturnValue(0);
      const minColor = getDefaultColor(0);
      expect(minColor[0]).toBe(0.4); // MIN_BRIGHTNESS

      vi.spyOn(randomModule, 'seededRandom').mockReturnValue(1);
      const maxColor = getDefaultColor(0);
      expect(maxColor[0]).toBe(0.8); // MIN_BRIGHTNESS + BRIGHTNESS_RANGE
    });

    it('returns consistent results for same index', () => {
      vi.spyOn(randomModule, 'seededRandom').mockReturnValue(0.75);
      const color1 = getDefaultColor(3);
      const color2 = getDefaultColor(3);

      expect(color1).toEqual(color2);
    });
  });

  describe('overlayColorsFor', () => {
    it('hands colorsFor the hovered verse', () => {
      const verses = [createVerse({ verse: 1 }), createVerse({ verse: 2 })];
      const colorsFor = vi.fn().mockReturnValue([[1, 0, 0], null]);
      const overlay: Overlay = { id: 'test', name: 'Test', getVerseColor: vi.fn(), colorsFor };

      const colors = overlayColorsFor(overlay, verses, 'settings', verses[1], 'data');

      expect(colors).toEqual([[1, 0, 0], null]);
      expect(colorsFor).toHaveBeenCalledWith(verses, 'settings', verses[1], 'data');
    });

    it('gives no colour to any item when there is no overlay', () => {
      const verses = [createVerse({ verse: 1 }), createVerse({ verse: 2 })];

      expect(overlayColorsFor(null, verses, undefined, null, undefined)).toEqual([null, null]);
    });
  });

  describe('layerToRecompute', () => {
    const a = createVerse({ verse: 1 });
    const b = createVerse({ verse: 2 });
    const hoverSensitive = testOverlay({
      id: 'hover',
      name: 'Hover',
      getVerseColor: () => null,
      hoverChangesColors: () => true,
    });
    const hoverBlind = testOverlay({ id: 'plain', name: 'Plain', getVerseColor: () => null });

    it('re-blends mid-transition when the hovered verse changes', () => {
      expect(
        layerToRecompute('blend', { tool: hoverBlind, settings: undefined, data: undefined }, a, b),
      ).toBe('blend');
    });

    it('recomputes nothing during a timed ease, whose colours were captured when it began', () => {
      expect(
        layerToRecompute(
          'ease',
          { tool: hoverSensitive, settings: undefined, data: undefined },
          a,
          b,
        ),
      ).toBe(null);
    });

    it('recomputes nothing when the hovered verse is unchanged, as on a pin', () => {
      expect(
        layerToRecompute(
          'blend',
          { tool: hoverSensitive, settings: undefined, data: undefined },
          a,
          a,
        ),
      ).toBe(null);
      expect(
        layerToRecompute(
          'overlay',
          { tool: hoverSensitive, settings: undefined, data: undefined },
          a,
          a,
        ),
      ).toBe(null);
    });

    it('recomputes nothing when the hover moves to another copy of the same square', () => {
      expect(
        layerToRecompute(
          'blend',
          { tool: hoverSensitive, settings: undefined, data: undefined },
          a,
          createVerse({ verse: 1 }),
        ),
      ).toBe(null);
    });

    it('recomputes a settled overlay only when its colours depend on the hover', () => {
      expect(
        layerToRecompute(
          'overlay',
          { tool: hoverSensitive, settings: undefined, data: undefined },
          a,
          b,
        ),
      ).toBe('overlay');
      expect(
        layerToRecompute(
          'overlay',
          { tool: hoverBlind, settings: undefined, data: undefined },
          a,
          b,
        ),
      ).toBe(null);
      expect(layerToRecompute('overlay', null, a, b)).toBe(null);
    });

    it('hands the overlay the settings and data to judge the hover by', () => {
      const hoverChangesColors = vi.fn().mockReturnValue(false);
      const overlay: Overlay = { ...hoverBlind, hoverChangesColors };

      layerToRecompute('overlay', { tool: overlay, settings: 'settings', data: 'data' }, a, b);

      expect(hoverChangesColors).toHaveBeenCalledWith(a, b, 'settings', 'data');
    });
  });
});
