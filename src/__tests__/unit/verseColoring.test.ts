import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDefaultColor,
  getOverlayColor,
  applyHoverHighlight,
  computeItemStates,
  applyItemColors,
} from '../../itemColoring';
import type { VerseLayout, ItemState } from '../../types';
import { versesEqual } from '../../types';
import type { Overlay, Color } from '../../overlays/types';
import * as randomModule from '../../utils/random';

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

  describe('getOverlayColor', () => {
    it('returns null when overlay is null', () => {
      const verse: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };

      const color = getOverlayColor(null, verse);

      expect(color).toBe(null);
    });

    it('returns overlay color when overlay provides color', () => {
      const verse: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };

      const mockOverlay: Overlay = {
        id: 'test',
        name: 'Test',
        init: vi.fn(),
        getVerseColor: vi.fn().mockReturnValue([1, 0, 0]),
      };

      const color = getOverlayColor(mockOverlay, verse);

      expect(color).toEqual([1, 0, 0]);
      expect(mockOverlay.getVerseColor).toHaveBeenCalledWith(verse);
    });

    it('returns null when overlay getVerseColor returns null', () => {
      const verse: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };

      const mockOverlay: Overlay = {
        id: 'test',
        name: 'Test',
        init: vi.fn(),
        getVerseColor: vi.fn().mockReturnValue(null),
      };

      const color = getOverlayColor(mockOverlay, verse);

      expect(color).toBe(null);
    });

    it('handles multi-color verses', () => {
      const verse: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 0,
        y: 0,
        size: 1,
      };

      const multiColor: [number, number, number][] = [
        [1, 0, 0],
        [0, 1, 0],
      ];
      const mockOverlay: Overlay = {
        id: 'test',
        name: 'Test',
        init: vi.fn(),
        getVerseColor: vi.fn().mockReturnValue(multiColor),
      };

      const color = getOverlayColor(mockOverlay, verse);

      expect(color).toEqual(multiColor);
    });
  });

  describe('applyHoverHighlight', () => {
    it('brightens single-color overlay verses by 1.5x', () => {
      const resolvedColor: [number, number, number] = [0.6, 0.4, 0.2];

      const highlighted = applyHoverHighlight(resolvedColor, true) as [number, number, number];

      expect(highlighted[0]).toBeCloseTo(0.9, 10);
      expect(highlighted[1]).toBeCloseTo(0.6, 10);
      expect(highlighted[2]).toBeCloseTo(0.3, 10);
    });

    it('clamps brightened colors to max 1.0', () => {
      const resolvedColor: [number, number, number] = [0.8, 0.9, 1.0];

      const highlighted = applyHoverHighlight(resolvedColor, true);

      expect(highlighted).toEqual([1.0, 1.0, 1.0]);
    });

    it('brightens multi-color overlay verses by 1.5x', () => {
      const resolvedColor: [number, number, number][] = [
        [0.4, 0.2, 0.6],
        [0.2, 0.8, 0.4],
      ];

      const highlighted = applyHoverHighlight(resolvedColor, true) as [number, number, number][];

      expect(highlighted[0][0]).toBeCloseTo(0.6, 10);
      expect(highlighted[0][1]).toBeCloseTo(0.3, 10);
      expect(highlighted[0][2]).toBeCloseTo(0.9, 10);
      expect(highlighted[1][0]).toBeCloseTo(0.3, 10);
      expect(highlighted[1][1]).toBeCloseTo(1.0, 10);
      expect(highlighted[1][2]).toBeCloseTo(0.6, 10);
    });

    it('replaces background verses with highlight color', () => {
      const resolvedColor: [number, number, number] = [0.5, 0.5, 0.5];

      const highlighted = applyHoverHighlight(resolvedColor, false);

      expect(highlighted).toEqual([0.2, 0.9, 1.0]); // HIGHLIGHT_COLOR
    });

    it('returns same type as input for multi-color', () => {
      const resolvedColor: [number, number, number][] = [[0.5, 0.5, 0.5]];

      const highlighted = applyHoverHighlight(resolvedColor, true);

      expect(Array.isArray(highlighted)).toBe(true);
      expect(Array.isArray(highlighted[0])).toBe(true);
    });
  });

  describe('computeItemStates', () => {
    beforeEach(() => {
      vi.spyOn(randomModule, 'seededRandom').mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('computes hasOverlayColor correctly when overlay provides color', () => {
      const verses: VerseLayout[] = [
        { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 1 },
      ];

      const mockOverlay: Overlay = {
        id: 'test',
        name: 'Test',
        init: vi.fn(),
        getVerseColor: vi.fn().mockReturnValue([1, 0, 0]),
      };

      const states = computeItemStates(verses, mockOverlay, null, null, versesEqual);

      expect(states[0].hasOverlayColor).toBe(true);
      expect(states[0].resolvedColor).toEqual([1, 0, 0]);
    });

    it('computes hasOverlayColor as false when overlay returns null', () => {
      const verses: VerseLayout[] = [
        { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 1 },
      ];

      const mockOverlay: Overlay = {
        id: 'test',
        name: 'Test',
        init: vi.fn(),
        getVerseColor: vi.fn().mockReturnValue(null),
      };

      const states = computeItemStates(verses, mockOverlay, null, null, versesEqual);

      expect(states[0].hasOverlayColor).toBe(false);
      const resolvedColor = states[0].resolvedColor as [number, number, number];
      expect(resolvedColor[0]).toBeCloseTo(0.6, 10);
      expect(resolvedColor[1]).toBeCloseTo(0.6, 10);
      expect(resolvedColor[2]).toBeCloseTo(0.6, 10);
    });

    it('uses default color when overlay is null', () => {
      const verses: VerseLayout[] = [
        { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 1 },
      ];

      const states = computeItemStates(verses, null, null, null, versesEqual);

      expect(states[0].hasOverlayColor).toBe(false);
      const resolvedColor = states[0].resolvedColor as [number, number, number];
      expect(resolvedColor[0]).toBeCloseTo(0.6, 10);
      expect(resolvedColor[1]).toBeCloseTo(0.6, 10);
      expect(resolvedColor[2]).toBeCloseTo(0.6, 10);
    });

    it('identifies hovered verse correctly', () => {
      const verses: VerseLayout[] = [
        { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 1 },
        { book: 'Genesis', chapter: 1, verse: 2, x: 10, y: 0, size: 1 },
      ];
      const hoveredVerse = verses[1];

      const states = computeItemStates(verses, null, hoveredVerse, null, versesEqual);

      expect(states[0].isHovered).toBe(false);
      expect(states[1].isHovered).toBe(true);
    });

    it('identifies pinned verse correctly', () => {
      const verses: VerseLayout[] = [
        { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 1 },
        { book: 'Genesis', chapter: 1, verse: 2, x: 10, y: 0, size: 1 },
      ];
      const pinnedVerse = verses[0];

      const states = computeItemStates(verses, null, null, pinnedVerse, versesEqual);

      expect(states[0].isPinned).toBe(true);
      expect(states[1].isPinned).toBe(false);
    });

    it('handles null hoveredVerse', () => {
      const verses: VerseLayout[] = [
        { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 1 },
      ];

      const states = computeItemStates(verses, null, null, null, versesEqual);

      expect(states[0].isHovered).toBe(false);
    });

    it('handles null pinnedVerse', () => {
      const verses: VerseLayout[] = [
        { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 1 },
      ];

      const states = computeItemStates(verses, null, null, null, versesEqual);

      expect(states[0].isPinned).toBe(false);
    });

    it('matches verses by book, chapter, and verse number', () => {
      const verses: VerseLayout[] = [
        { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 1 },
        { book: 'Genesis', chapter: 1, verse: 2, x: 10, y: 0, size: 1 },
        { book: 'Exodus', chapter: 1, verse: 1, x: 0, y: 10, size: 1 },
      ];
      const hoveredVerse: VerseLayout = {
        book: 'Genesis',
        chapter: 1,
        verse: 1,
        x: 999, // Different position - doesn't matter
        y: 999,
        size: 2,
      };

      const states = computeItemStates(verses, null, hoveredVerse, null, versesEqual);

      expect(states[0].isHovered).toBe(true); // Same book/chapter/verse
      expect(states[1].isHovered).toBe(false); // Different verse
      expect(states[2].isHovered).toBe(false); // Different book
    });

    it('returns array parallel to verses', () => {
      const verses: VerseLayout[] = [
        { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 1 },
        { book: 'Genesis', chapter: 1, verse: 2, x: 10, y: 0, size: 1 },
        { book: 'Genesis', chapter: 1, verse: 3, x: 20, y: 0, size: 1 },
      ];

      const states = computeItemStates(verses, null, null, null, versesEqual);

      expect(states.length).toBe(3);
    });

  });

  describe('applyItemColors', () => {
    it('applies base colors', () => {
      const states: ItemState[] = [
        {
          hasOverlayColor: true,
          resolvedColor: [1, 0, 0],
          isHovered: false,
          isPinned: false,
        },
      ];

      const colors = applyItemColors(states);

      expect(colors[0]).toEqual([1, 0, 0]);
    });

    it('applies hover highlighting when verse is hovered', () => {
      const states: ItemState[] = [
        {
          hasOverlayColor: true,
          resolvedColor: [0.6, 0.4, 0.2],
          isHovered: true,
          isPinned: false,
        },
      ];

      const colors = applyItemColors(states);

      const color = colors[0] as [number, number, number];
      expect(color[0]).toBeCloseTo(0.9, 10);
      expect(color[1]).toBeCloseTo(0.6, 10);
      expect(color[2]).toBeCloseTo(0.3, 10);
    });

    it('does not apply hover highlighting when verse is not hovered', () => {
      const states: ItemState[] = [
        {
          hasOverlayColor: true,
          resolvedColor: [0.6, 0.4, 0.2],
          isHovered: false,
          isPinned: false,
        },
      ];

      const colors = applyItemColors(states);

      expect(colors[0]).toEqual([0.6, 0.4, 0.2]); // Unchanged
    });

    it('returns immutable color array', () => {
      const states: ItemState[] = [
        {
          hasOverlayColor: false,
          resolvedColor: [0.5, 0.5, 0.5],
          isHovered: false,
          isPinned: false,
        },
      ];

      const colors = applyItemColors(states);

      expect(colors).toBeInstanceOf(Array);
      expect(colors.length).toBe(1);
      expect(colors[0]).toEqual([0.5, 0.5, 0.5]);
    });

    it('handles multiple verses', () => {
      const states: ItemState[] = [
        {
          hasOverlayColor: false,
          resolvedColor: [0.5, 0.5, 0.5],
          isHovered: false,
          isPinned: false,
        },
        {
          hasOverlayColor: true,
          resolvedColor: [1, 0, 0],
          isHovered: true,
          isPinned: false,
        },
        {
          hasOverlayColor: true,
          resolvedColor: [0, 1, 0],
          isHovered: false,
          isPinned: true,
        },
      ];

      const colors = applyItemColors(states);

      expect(colors[0]).toEqual([0.5, 0.5, 0.5]);
      expect(colors[1]).toEqual([1, 0, 0]); // Hovered, already at max
      expect(colors[2]).toEqual([0, 1, 0]); // Pinned but not hovered
    });

    it('handles multi-color verses', () => {
      const multiColor: [number, number, number][] = [
        [0.4, 0.2, 0.6],
        [0.2, 0.8, 0.4],
      ];
      const states: ItemState[] = [
        {
          hasOverlayColor: true,
          resolvedColor: multiColor,
          isHovered: true,
          isPinned: false,
        },
      ];

      const colors = applyItemColors(states);

      const color = colors[0] as [number, number, number][];
      expect(color[0][0]).toBeCloseTo(0.6, 10);
      expect(color[0][1]).toBeCloseTo(0.3, 10);
      expect(color[0][2]).toBeCloseTo(0.9, 10);
      expect(color[1][0]).toBeCloseTo(0.3, 10);
      expect(color[1][1]).toBeCloseTo(1.0, 10);
      expect(color[1][2]).toBeCloseTo(0.6, 10);
    });
  });

  describe('integration', () => {
    beforeEach(() => {
      vi.spyOn(randomModule, 'seededRandom').mockReturnValue(0.5);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('supports full workflow: compute states then apply colors', () => {
      const verses: VerseLayout[] = [
        { book: 'Genesis', chapter: 1, verse: 1, x: 0, y: 0, size: 1 },
        { book: 'Genesis', chapter: 1, verse: 2, x: 10, y: 0, size: 1 },
      ];

      const mockOverlay: Overlay = {
        id: 'test',
        name: 'Test',
        init: vi.fn(),
        getVerseColor: vi.fn((v) => {
          return v.verse === 1 ? [1, 0, 0] as Color : null;
        }),
      };

      const hoveredVerse = verses[1];

      // First pass: compute states
      const states = computeItemStates(
        verses,
        mockOverlay,
        hoveredVerse,
        null,
        versesEqual,
      );

      expect(states[0].hasOverlayColor).toBe(true);
      expect(states[0].resolvedColor).toEqual([1, 0, 0]);
      expect(states[0].isHovered).toBe(false);

      expect(states[1].hasOverlayColor).toBe(false);
      const resolvedColor = states[1].resolvedColor as [number, number, number];
      expect(resolvedColor[0]).toBeCloseTo(0.6, 10);
      expect(resolvedColor[1]).toBeCloseTo(0.6, 10);
      expect(resolvedColor[2]).toBeCloseTo(0.6, 10);
      expect(states[1].isHovered).toBe(true);

      // Second pass: apply colors
      const colors = applyItemColors(states);

      expect(colors[0]).toEqual([1, 0, 0]); // Overlay color, not hovered
      expect(colors[1]).toEqual([0.2, 0.9, 1.0]); // Background hovered -> highlight
    });
  });
});
