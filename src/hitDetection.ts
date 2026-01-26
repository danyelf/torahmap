// Hit Detection module - handles verse hit detection from screen coordinates

import type { Verse } from './types';
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
 * @param verse - Verse to test
 * @returns true if point is inside verse bounds
 */
export function isPointInVerse(
  worldX: number,
  worldY: number,
  verse: Verse
): boolean {
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
 * @returns Verse at point, or null if none found
 */
export function findExactHit(
  verses: Verse[],
  worldX: number,
  worldY: number
): Verse | null {
  for (const v of verses) {
    if (isPointInVerse(worldX, worldY, v)) {
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
  verses: Verse[],
  worldX: number,
  worldY: number
): Verse | null {
  let nearestVerse: Verse | null = null;
  let nearestDistSq =
    HIGHLIGHT_CONSTANTS.FUZZY_RADIUS * HIGHLIGHT_CONSTANTS.FUZZY_RADIUS;

  for (const v of verses) {
    // Find center of verse square
    const centerX = v.x + v.size / 2;
    const centerY = v.y + v.size / 2;

    // Distance from point to verse center
    const dx = worldX - centerX;
    const dy = worldY - centerY;
    const distSq = dx * dx + dy * dy;

    // If within fuzzy radius and closer than previous best
    if (distSq < nearestDistSq) {
      nearestVerse = v;
      nearestDistSq = distSq;
    }
  }

  return nearestVerse;
}

/**
 * Find verse at screen coordinates.
 * First tries exact hit detection, then falls back to fuzzy matching.
 *
 * @param verses - All verses
 * @param camera - Camera state with pan and zoom
 * @param screenX - X coordinate in screen space
 * @param screenY - Y coordinate in screen space
 * @returns Verse at point, or null if none found
 */
export function findVerseAtPoint(
  verses: Verse[],
  camera: Camera,
  screenX: number,
  screenY: number
): Verse | null {
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
