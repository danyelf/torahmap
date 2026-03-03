// Hit Detection module - handles verse hit detection from screen coordinates

import type { VerseLayout } from './types';
import type { Camera } from './camera';
import { HIGHLIGHT_CONSTANTS } from './constants';

/**
 * Convert screen coordinates to world coordinates.
 *
 * @param screenX - X coordinate in screen space
 * @param screenY - Y coordinate in screen space
 * @param camera - Camera state with pan and zoom
 * @returns World coordinates
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera
): { x: number; y: number } {
  return {
    x: screenX / camera.zoom - camera.x,
    y: screenY / camera.zoom - camera.y,
  };
}

/**
 * Check if a point (in world coordinates) is inside a verse's bounds.
 *
 * @param worldX - X coordinate in world space
 * @param worldY - Y coordinate in world space
 * @param verse - VerseLayout to test
 * @returns true if point is inside verse bounds
 */
export function isPointInVerseLayout(
  worldX: number,
  worldY: number,
  verse: VerseLayout
): boolean {
  if (verse.segments) {
    return verse.segments.some(seg =>
      worldX >= seg.x &&
      worldX < seg.x + seg.width &&
      worldY >= seg.y &&
      worldY < seg.y + seg.height
    );
  }
  return (
    worldX >= verse.x &&
    worldX < verse.x + verse.size &&
    worldY >= verse.y &&
    worldY < verse.y + verse.size
  );
}

/**
 * Find verse at exact world coordinates (no fuzzy matching).
 *
 * @param verses - All verses
 * @param worldX - X coordinate in world space
 * @param worldY - Y coordinate in world space
 * @returns VerseLayout at point, or null if none found
 */
export function findExactHit(
  verses: VerseLayout[],
  worldX: number,
  worldY: number
): VerseLayout | null {
  for (const v of verses) {
    if (isPointInVerseLayout(worldX, worldY, v)) {
      return v;
    }
  }
  return null;
}

/**
 * Find nearest verse within fuzzy radius from world coordinates.
 * Uses distance to verse center, not bounds.
 *
 * @param verses - All verses
 * @param worldX - X coordinate in world space
 * @param worldY - Y coordinate in world space
 * @returns Nearest verse within fuzzy radius, or null if none found
 */
export function findFuzzyHit(
  verses: VerseLayout[],
  worldX: number,
  worldY: number
): VerseLayout | null {
  let nearestVerseLayout: VerseLayout | null = null;
  let nearestDistSq =
    HIGHLIGHT_CONSTANTS.FUZZY_RADIUS * HIGHLIGHT_CONSTANTS.FUZZY_RADIUS;

  for (const v of verses) {
    let bestDistSq = Infinity;

    if (v.segments) {
      for (const seg of v.segments) {
        const centerX = seg.x + seg.width / 2;
        const centerY = seg.y + seg.height / 2;
        const dx = worldX - centerX;
        const dy = worldY - centerY;
        bestDistSq = Math.min(bestDistSq, dx * dx + dy * dy);
      }
    } else {
      const centerX = v.x + v.size / 2;
      const centerY = v.y + v.size / 2;
      const dx = worldX - centerX;
      const dy = worldY - centerY;
      bestDistSq = dx * dx + dy * dy;
    }

    // If within fuzzy radius and closer than previous best
    if (bestDistSq < nearestDistSq) {
      nearestVerseLayout = v;
      nearestDistSq = bestDistSq;
    }
  }

  return nearestVerseLayout;
}

/**
 * Find verse at screen coordinates.
 * First tries exact hit detection, then falls back to fuzzy matching.
 *
 * @param verses - All verses
 * @param camera - Camera state with pan and zoom
 * @param screenX - X coordinate in screen space
 * @param screenY - Y coordinate in screen space
 * @returns VerseLayout at point, or null if none found
 */
export function findVerseLayoutAtPoint(
  verses: VerseLayout[],
  camera: Camera,
  screenX: number,
  screenY: number
): VerseLayout | null {
  // Convert screen coords to world coords
  const { x: worldX, y: worldY } = screenToWorld(screenX, screenY, camera);

  // First, try exact hit detection
  const exactHit = findExactHit(verses, worldX, worldY);
  if (exactHit) {
    return exactHit;
  }

  // If no exact hit, find nearest verse within fuzzy radius
  return findFuzzyHit(verses, worldX, worldY);
}
