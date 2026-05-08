// Hit Detection module - handles verse hit detection from screen coordinates

import type { SpatialItem } from './types';
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
 * Check if a point (in world coordinates) is inside a spatial item's bounds.
 */
export function isPointInVerseLayout<T>(
  worldX: number,
  worldY: number,
  verse: SpatialItem<T>
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
 */
export function findExactHit<T>(
  verses: SpatialItem<T>[],
  worldX: number,
  worldY: number
): SpatialItem<T> | null {
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
 */
export function findFuzzyHit<T>(
  verses: SpatialItem<T>[],
  worldX: number,
  worldY: number
): SpatialItem<T> | null {
  let nearestVerseLayout: SpatialItem<T> | null = null;
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
      nearestVerseLayout = v;
      nearestDistSq = distSq;
    }
  }

  return nearestVerseLayout;
}

/**
 * Find verse at screen coordinates.
 * First tries exact hit detection, then falls back to fuzzy matching.
 */
export function findItemAtPoint<T>(
  verses: SpatialItem<T>[],
  camera: Camera,
  screenX: number,
  screenY: number
): SpatialItem<T> | null {
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
