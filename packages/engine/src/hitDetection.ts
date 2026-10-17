// Hit Detection module - handles square hit detection from screen coordinates

import type { SpatialItem } from './types.ts';
import { screenToWorld, type Camera, type Viewport } from './camera.ts';
import { HIGHLIGHT_CONSTANTS, STANDOUT_MIN_PX } from './constants.ts';

/** Check if a point (in world coordinates) is inside a spatial item's bounds. */
export function isPointInItem<T>(worldX: number, worldY: number, item: SpatialItem<T>): boolean {
  return (
    worldX >= item.x &&
    worldX < item.x + item.size &&
    worldY >= item.y &&
    worldY < item.y + item.size
  );
}

/** Find square at exact world coordinates (no fuzzy matching). */
export function findExactHit<T>(
  items: SpatialItem<T>[],
  worldX: number,
  worldY: number,
): SpatialItem<T> | null {
  for (const v of items) {
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
  items: SpatialItem<T>[],
  worldX: number,
  worldY: number,
  maxDistance: number = Infinity,
): SpatialItem<T> | null {
  let nearestItem: SpatialItem<T> | null = null;
  let nearestDistSq = maxDistance * maxDistance;

  for (const v of items) {
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

/** Find the nearest square within the fuzzy radius of a world point. */
export function findFuzzyHit<T>(
  items: SpatialItem<T>[],
  worldX: number,
  worldY: number,
): SpatialItem<T> | null {
  return findNearestItem(items, worldX, worldY, HIGHLIGHT_CONSTANTS.FUZZY_RADIUS);
}

/**
 * The standout under a world point, by the square it is drawn as: at least
 * STANDOUT_MIN_PX a side around its cell's centre. The last one drawn is on top.
 */
export function findStandoutHit<T>(
  items: SpatialItem<T>[],
  standout: readonly boolean[],
  zoom: number,
  worldX: number,
  worldY: number,
): SpatialItem<T> | null {
  let hit: SpatialItem<T> | null = null;
  for (let i = 0; i < items.length; i++) {
    if (!standout[i]) continue;
    const v = items[i];
    const half = Math.max(v.size, STANDOUT_MIN_PX / zoom) / 2;
    const dx = Math.abs(worldX - (v.x + v.size / 2));
    const dy = Math.abs(worldY - (v.y + v.size / 2));
    if (dx < half && dy < half) hit = v;
  }
  return hit;
}

/**
 * Find square at screen coordinates: a standout as drawn first, then exact hit
 * detection, falling back to fuzzy matching so a near-miss still lands on
 * something.
 */
export function findItemAtPoint<T>(
  items: SpatialItem<T>[],
  camera: Camera,
  viewport: Viewport,
  screenX: number,
  screenY: number,
  standout: readonly boolean[] = [],
): SpatialItem<T> | null {
  const { x: worldX, y: worldY } = screenToWorld({ x: screenX, y: screenY }, camera, viewport);

  const standoutHit = findStandoutHit(items, standout, camera.zoom, worldX, worldY);
  if (standoutHit) return standoutHit;

  const exactHit = findExactHit(items, worldX, worldY);
  if (exactHit) {
    return exactHit;
  }

  return findFuzzyHit(items, worldX, worldY);
}
