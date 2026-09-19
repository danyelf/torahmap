// Hit Detection module - handles verse hit detection from screen coordinates

import type { SpatialItem } from './types';
import type { Camera } from './camera';
import { HIGHLIGHT_CONSTANTS } from './constants';

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: Camera,
): { x: number; y: number } {
  return {
    x: screenX / camera.zoom - camera.x,
    y: screenY / camera.zoom - camera.y,
  };
}

/** Check if a point (in world coordinates) is inside a spatial item's bounds. */
export function isPointInItem<T>(worldX: number, worldY: number, verse: SpatialItem<T>): boolean {
  return (
    worldX >= verse.x &&
    worldX < verse.x + verse.size &&
    worldY >= verse.y &&
    worldY < verse.y + verse.size
  );
}

/** Find verse at exact world coordinates (no fuzzy matching). */
export function findExactHit<T>(
  verses: SpatialItem<T>[],
  worldX: number,
  worldY: number,
): SpatialItem<T> | null {
  for (const v of verses) {
    if (isPointInItem(worldX, worldY, v)) {
      return v;
    }
  }
  return null;
}

/**
 * Find the item whose centre is nearest a world point, closer than
 * `maxDistance` if one is given.
 */
export function findNearestItem<T>(
  verses: SpatialItem<T>[],
  worldX: number,
  worldY: number,
  maxDistance: number = Infinity,
): SpatialItem<T> | null {
  let nearestItem: SpatialItem<T> | null = null;
  let nearestDistSq = maxDistance * maxDistance;

  for (const v of verses) {
    const centerX = v.x + v.size / 2;
    const centerY = v.y + v.size / 2;

    const dx = worldX - centerX;
    const dy = worldY - centerY;
    const distSq = dx * dx + dy * dy;

    if (distSq < nearestDistSq) {
      nearestItem = v;
      nearestDistSq = distSq;
    }
  }

  return nearestItem;
}

/** Find the nearest verse within the fuzzy radius of a world point. */
export function findFuzzyHit<T>(
  verses: SpatialItem<T>[],
  worldX: number,
  worldY: number,
): SpatialItem<T> | null {
  return findNearestItem(verses, worldX, worldY, HIGHLIGHT_CONSTANTS.FUZZY_RADIUS);
}

/**
 * Find verse at screen coordinates: exact hit detection first, falling back
 * to fuzzy matching so a near-miss still lands on something.
 */
export function findItemAtPoint<T>(
  verses: SpatialItem<T>[],
  camera: Camera,
  screenX: number,
  screenY: number,
): SpatialItem<T> | null {
  const { x: worldX, y: worldY } = screenToWorld(screenX, screenY, camera);

  const exactHit = findExactHit(verses, worldX, worldY);
  if (exactHit) {
    return exactHit;
  }

  return findFuzzyHit(verses, worldX, worldY);
}
