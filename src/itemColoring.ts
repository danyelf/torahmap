// Color computation and hover highlighting for spatial items

import type { SpatialItem, ItemState } from './types';
import type { Overlay } from './overlays/types';
import { seededRandom } from './utils/random';
import { HIGHLIGHT_CONSTANTS } from './constants';

/**
 * Default gray for a verse with no overlay color, brightness-varied by a
 * seeded random to reduce moiré.
 */
export function getDefaultColor(verseIndex: number): [number, number, number] {
  const brightness =
    HIGHLIGHT_CONSTANTS.MIN_BRIGHTNESS +
    seededRandom(verseIndex * 3) * HIGHLIGHT_CONSTANTS.BRIGHTNESS_RANGE;
  return [brightness, brightness, brightness];
}

/**
 * Get overlay-provided color for a spatial item, or null if overlay doesn't color it.
 */
export function getOverlayColor<T>(
  overlay: Overlay<T> | null,
  item: T,
): [number, number, number] | [number, number, number][] | null {
  return overlay?.getVerseColor(item) ?? null;
}

/**
 * Apply hover highlighting to a verse color: overlay-colored verses brighten,
 * background verses (no overlay color) are replaced with the highlight color.
 */
export function applyHoverHighlight(
  baseColor: [number, number, number] | [number, number, number][],
  hasOverlayColor: boolean,
): [number, number, number] | [number, number, number][] {
  if (hasOverlayColor) {
    if (Array.isArray(baseColor[0])) {
      return (baseColor as [number, number, number][]).map(
        (c) =>
          [
            Math.min(1, c[0] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
            Math.min(1, c[1] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
            Math.min(1, c[2] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
          ] as [number, number, number],
      );
    } else {
      const c = baseColor as [number, number, number];
      return [
        Math.min(1, c[0] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
        Math.min(1, c[1] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
        Math.min(1, c[2] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
      ];
    }
  } else {
    return HIGHLIGHT_CONSTANTS.HIGHLIGHT_COLOR;
  }
}

/**
 * Compute semantic state for all items: what is true about each one
 * (hasOverlayColor, resolvedColor, isHovered, isPinned). Returns an array
 * parallel to items.
 *
 * Equality is injected as a parameter because each corpus has its own
 * identity shape. Tanakh callers pass tanakhIdentitiesEqual; Talmud callers pass
 * their equivalent.
 */
export function computeItemStates<T>(
  items: SpatialItem<T>[],
  overlay: Overlay<T> | null,
  hoveredItem: SpatialItem<T> | null,
  pinnedItem: SpatialItem<T> | null,
  itemsEqual: (a: T | null, b: T | null) => boolean,
): ItemState[] {
  return items.map((v, i) => {
    const overlayColor = getOverlayColor(overlay, v);
    const hasOverlayColor = overlayColor !== null;
    const resolvedColor = hasOverlayColor ? overlayColor : getDefaultColor(i);

    const isHovered = itemsEqual(hoveredItem, v);
    const isPinned = itemsEqual(pinnedItem, v);

    return {
      hasOverlayColor,
      resolvedColor,
      isHovered,
      isPinned,
    };
  });
}

/**
 * Apply colors based on computed states: base color, then hover highlighting.
 * Returns an immutable color array parallel to item states.
 */
export function applyItemColors(
  verseStates: ItemState[],
): ([number, number, number] | [number, number, number][])[] {
  return verseStates.map((state) => {
    let finalColor = state.resolvedColor;

    if (state.isHovered) {
      finalColor = applyHoverHighlight(finalColor, state.hasOverlayColor);
    }

    return finalColor;
  });
}
