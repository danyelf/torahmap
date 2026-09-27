import { describe, it, expect } from 'vitest';
import {
  isPointInItem,
  findExactHit,
  findFuzzyHit,
  findNearestItem,
  findItemAtPoint,
} from '../../hitDetection';
import type { TanakhLayout } from '../../types';
import type { Camera } from '../../camera';
import { createVerse } from '../helpers/fixtures';

const VIEW = { width: 800, height: 600 };
/** The camera that draws map (0, 0) at screen (ox × zoom, oy × zoom). */
const withOrigin = (ox: number, oy: number, zoom: number): Camera => ({
  x: VIEW.width / (2 * zoom) - ox,
  y: VIEW.height / (2 * zoom) - oy,
  zoom,
});

describe('hitDetection', () => {
  describe('isPointInItem', () => {
    const verse: TanakhLayout = createVerse({ x: 100, y: 200, size: 50 });

    it('returns true when point is inside verse bounds', () => {
      expect(isPointInItem(125, 225, verse)).toBe(true);
      expect(isPointInItem(100, 200, verse)).toBe(true); // Top-left corner
      expect(isPointInItem(149, 249, verse)).toBe(true); // Just inside
    });

    it('returns false when point is outside verse bounds', () => {
      expect(isPointInItem(99, 225, verse)).toBe(false); // Left of verse
      expect(isPointInItem(150, 199, verse)).toBe(false); // Above verse
      expect(isPointInItem(125, 250, verse)).toBe(false); // Below verse (exclusive)
      expect(isPointInItem(150, 225, verse)).toBe(false); // Right of verse (exclusive)
    });

    it('handles point at exact right edge (exclusive)', () => {
      // x + size is exclusive
      expect(isPointInItem(150, 225, verse)).toBe(false);
    });

    it('handles point at exact bottom edge (exclusive)', () => {
      // y + size is exclusive
      expect(isPointInItem(125, 250, verse)).toBe(false);
    });

    it('handles point at top-left corner (inclusive)', () => {
      expect(isPointInItem(100, 200, verse)).toBe(true);
    });

    it('handles very small verse', () => {
      const smallVerse: TanakhLayout = createVerse({ x: 0, y: 0, size: 1 });

      expect(isPointInItem(0, 0, smallVerse)).toBe(true);
      expect(isPointInItem(0.5, 0.5, smallVerse)).toBe(true);
      expect(isPointInItem(1, 0.5, smallVerse)).toBe(false);
    });
  });

  describe('findExactHit', () => {
    const verses: TanakhLayout[] = [
      createVerse({ x: 0, y: 0, size: 10 }),
      createVerse({ verse: 2, x: 20, y: 0, size: 10 }),
      createVerse({ verse: 3, x: 40, y: 0, size: 10 }),
    ];

    it('finds verse when point is inside bounds', () => {
      const hit = findExactHit(verses, 5, 5);

      expect(hit).toBe(verses[0]);
    });

    it('returns null when no verse found', () => {
      const hit = findExactHit(verses, 100, 100);

      expect(hit).toBe(null);
    });

    it('finds correct verse among multiple', () => {
      const hit = findExactHit(verses, 25, 5);

      expect(hit).toBe(verses[1]);
    });

    it('returns first match when verses overlap', () => {
      const overlappingVerses: TanakhLayout[] = [
        createVerse({ x: 0, y: 0, size: 20 }),
        createVerse({ verse: 2, y: 10, size: 20 }),
      ];

      const hit = findExactHit(overlappingVerses, 15, 15);

      expect(hit).toBe(overlappingVerses[0]); // First in array
    });

    it('handles empty verses array', () => {
      const hit = findExactHit([], 5, 5);

      expect(hit).toBe(null);
    });

    it('handles point at verse edge (exclusive right/bottom)', () => {
      expect(findExactHit(verses, 10, 5)).toBe(null); // Right edge of first verse
      expect(findExactHit(verses, 5, 10)).toBe(null); // Bottom edge of first verse
    });
  });

  describe('findFuzzyHit', () => {
    const verses: TanakhLayout[] = [
      createVerse({ x: 0, y: 0, size: 10 }),
      createVerse({ verse: 2, x: 20, y: 0, size: 10 }),
      createVerse({ verse: 3, x: 100, y: 100, size: 10 }),
    ];

    it('finds verse within fuzzy radius', () => {
      // Point at (7, 7), verse center at (5, 5), distance ≈ 2.83 < 10
      const hit = findFuzzyHit(verses, 7, 7);

      expect(hit).toBe(verses[0]);
    });

    it('returns null when no verse within fuzzy radius', () => {
      // Point at (50, 50), all verses > 10 units away from centers
      const hit = findFuzzyHit(verses, 50, 50);

      expect(hit).toBe(null);
    });

    it('returns closest verse when multiple are within radius', () => {
      // Point at (12, 5)
      // Distance to verse[0] center (5, 5): sqrt((12-5)^2 + 0^2) = 7
      // Distance to verse[1] center (25, 5): sqrt((12-25)^2 + 0^2) = 13
      const hit = findFuzzyHit(verses, 12, 5);

      expect(hit).toBe(verses[0]); // Closer
    });

    it('uses verse center for distance calculation', () => {
      // Verse at (0, 0) size 10 has center at (5, 5)
      // Point at (5, 5) has distance 0 to center
      const hit = findFuzzyHit(verses, 5, 5);

      expect(hit).toBe(verses[0]);
    });

    it('handles empty verses array', () => {
      const hit = findFuzzyHit([], 5, 5);

      expect(hit).toBe(null);
    });

    it('finds verse even when point is inside (uses center distance)', () => {
      // Point at (2, 2) is inside verse[0] but also checks fuzzy
      const hit = findFuzzyHit(verses, 2, 2);

      expect(hit).toBe(verses[0]);
    });

    it('respects FUZZY_RADIUS constant (10 units)', () => {
      // FUZZY_RADIUS = 10
      // Point at (16, 5)
      // Distance to verse[0] center (5, 5) = 11 > 10 (not found)
      // Distance to verse[1] center (25, 5) = 9 < 10 (found!)
      const hit = findFuzzyHit(verses, 16, 5);

      expect(hit).toBe(verses[1]); // Finds verse[1], not verse[0]
    });
  });

  describe('findNearestItem', () => {
    const verses: TanakhLayout[] = [
      createVerse({ x: 0, y: 0, size: 10 }),
      createVerse({ verse: 2, x: 100, y: 100, size: 10 }),
    ];

    it('finds the nearest centre at any distance when given no limit', () => {
      expect(findNearestItem(verses, 500, 500)).toBe(verses[1]);
      expect(findNearestItem(verses, 40, 40)).toBe(verses[0]);
    });

    it('finds nothing beyond the limit it is given', () => {
      expect(findNearestItem(verses, 40, 40, 10)).toBe(null);
    });
  });

  describe('findItemAtPoint', () => {
    const verses: TanakhLayout[] = [
      createVerse({ x: 0, y: 0, size: 10 }),
      createVerse({ verse: 2, x: 20, y: 0, size: 10 }),
    ];

    it('finds verse using exact hit when available', () => {
      const camera = withOrigin(0, 0, 1.0);

      const hit = findItemAtPoint(verses, camera, VIEW, 5, 5);

      expect(hit).toBe(verses[0]);
    });

    it('falls back to fuzzy hit when no exact match', () => {
      const camera = withOrigin(0, 0, 1.0);

      // Point at (12, 5) - not inside any verse, but within fuzzy radius of verse[0]
      const hit = findItemAtPoint(verses, camera, VIEW, 12, 5);

      expect(hit).toBe(verses[0]);
    });

    it('returns null when no exact or fuzzy hit', () => {
      const camera = withOrigin(0, 0, 1.0);

      const hit = findItemAtPoint(verses, camera, VIEW, 100, 100);

      expect(hit).toBe(null);
    });

    it('handles camera zoom', () => {
      const camera = withOrigin(0, 0, 2.0);

      // Screen (10, 10) -> World (5, 5) at 2x zoom
      const hit = findItemAtPoint(verses, camera, VIEW, 10, 10);

      expect(hit).toBe(verses[0]);
    });

    it('handles camera pan', () => {
      const camera = withOrigin(100, 100, 1.0);

      // Screen (105, 105) -> World (5, 5) with pan offset
      const hit = findItemAtPoint(verses, camera, VIEW, 105, 105);

      expect(hit).toBe(verses[0]);
    });

    it('handles combined zoom and pan', () => {
      const camera = withOrigin(50, 50, 2.0);

      // Screen (60, 60) -> World (60/2 - 50, 60/2 - 50) = (-20, -20)
      // No verses at negative coordinates in this test
      const hit = findItemAtPoint(verses, camera, VIEW, 60, 60);

      expect(hit).toBe(null);
    });

    it('prefers exact hit over fuzzy hit', () => {
      const camera = withOrigin(0, 0, 1.0);

      // Point at (5, 5) - inside verse[0] exactly, also within fuzzy radius
      const hit = findItemAtPoint(verses, camera, VIEW, 5, 5);

      expect(hit).toBe(verses[0]);
    });

    it('handles negative world coordinates after transformation', () => {
      const camera = withOrigin(-10, -10, 1.0);

      // Screen (0, 0) -> World (10, 10) - inside second verse? No, first verse
      // Actually: 0/1.0 - (-10) = 10, so point at (10, 0) which is edge of first verse
      const hit = findItemAtPoint(verses, camera, VIEW, 0, 0);

      // (10, 0) is not inside first verse (x: 0-10 exclusive), but within fuzzy radius
      expect(hit).not.toBe(null); // Should find something via fuzzy
    });
  });

  describe('integration', () => {
    it('supports typical hover workflow with camera', () => {
      const verses: TanakhLayout[] = [createVerse({ x: 100, y: 200, size: 10 })];
      const camera = withOrigin(50, 100, 2.0);

      // Screen (250, 350) -> World (250/2 - 50, 350/2 - 100) = (75, 75)
      // Verse is at (100, 200) size 10, so not an exact hit
      // But should find via fuzzy if close enough to center (105, 205)
      const hit1 = findItemAtPoint(verses, camera, VIEW, 250, 350);
      expect(hit1).toBe(null); // Too far

      // Screen (310, 510) -> World (155, 255)
      // Distance to center (105, 205): sqrt(50^2 + 50^2) ≈ 70 > 10
      const hit2 = findItemAtPoint(verses, camera, VIEW, 310, 510);
      expect(hit2).toBe(null); // Still too far

      // Screen (260, 460) -> World (130, 230)
      // Distance to center (105, 205): sqrt(25^2 + 25^2) ≈ 35 > 10
      const hit3 = findItemAtPoint(verses, camera, VIEW, 260, 460);
      expect(hit3).toBe(null); // Too far

      // Screen (210, 410) -> World (55, 105)
      // Actually: 210/2 - 50 = 55, 410/2 - 100 = 105
      // Distance to center (105, 205): sqrt(50^2 + 100^2) ≈ 111.8 > 10
      const hit4 = findItemAtPoint(verses, camera, VIEW, 210, 410);
      expect(hit4).toBe(null); // Too far

      // Screen (310, 610) -> World (310/2 - 50, 610/2 - 100) = (105, 205) - exact center!
      const hit5 = findItemAtPoint(verses, camera, VIEW, 310, 610);
      expect(hit5).toBe(verses[0]); // Found at exact center!
    });

    it('handles verse grid navigation', () => {
      // 3x3 grid of verses
      const verses: TanakhLayout[] = [];
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 3; x++) {
          verses.push(
            createVerse({
              book: 'Test',
              chapter: y + 1,
              verse: x + 1,
              x: x * 20,
              y: y * 20,
              size: 10,
            }),
          );
        }
      }

      const camera = withOrigin(0, 0, 1.0);

      // Test center of each verse
      expect(findItemAtPoint(verses, camera, VIEW, 5, 5)).toBe(verses[0]); // (0,0)
      expect(findItemAtPoint(verses, camera, VIEW, 25, 5)).toBe(verses[1]); // (1,0)
      expect(findItemAtPoint(verses, camera, VIEW, 45, 5)).toBe(verses[2]); // (2,0)
      expect(findItemAtPoint(verses, camera, VIEW, 5, 25)).toBe(verses[3]); // (0,1)
      expect(findItemAtPoint(verses, camera, VIEW, 25, 25)).toBe(verses[4]); // (1,1)
    });
  });
});
