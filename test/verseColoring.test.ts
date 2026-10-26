import { describe, it, expect, vi } from 'vitest';
import type { TanakhOverlay } from '@torahmap/tanakh/overlays/index.ts';
import { overlayColorsFor, layerToRecompute } from '../packages/shell/src/itemColoring.ts';
import { createVerse, testOverlay } from '../apps/tanakh/test/helpers/fixtures.ts';

describe('itemColoring', () => {
  describe('overlayColorsFor', () => {
    it('hands colorsFor the hovered verse', () => {
      const verses = [createVerse({ verse: 1 }), createVerse({ verse: 2 })];
      const colorsFor = vi.fn().mockReturnValue([[1, 0, 0], null]);
      const overlay: TanakhOverlay = {
        id: 'test',
        name: 'Test',
        colorsFor,
      };

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
      hoverChangesColors: () => true,
    });
    const hoverBlind = testOverlay({ id: 'plain', name: 'Plain' });

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
      const overlay: TanakhOverlay = { ...hoverBlind, hoverChangesColors };

      layerToRecompute('overlay', { tool: overlay, settings: 'settings', data: 'data' }, a, b);

      expect(hoverChangesColors).toHaveBeenCalledWith(a, b, 'settings', 'data');
    });
  });
});
