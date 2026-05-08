// Verse Coloring module - handles verse color computation and highlighting

import type { SpatialItem, VerseState } from "./types";
import type { Overlay } from "./overlays/types";
import { seededRandom } from "./utils/random";
import { HIGHLIGHT_CONSTANTS } from "./constants";

/**
 * Get default gray color with brightness variation for a verse.
 * Uses seeded random to ensure consistent appearance.
 *
 * @param verseIndex - Index of verse in verses array
 * @returns RGB color tuple with brightness variation
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
 * Apply hover highlighting to a verse color.
 * Second pass: modifies colors based on hover state.
 * - Verses with overlay color: brighten by 1.5x
 * - Verses without overlay color (background): replace with highlight color
 *
 * @param baseColor - Base color (single or array for multi-color verses)
 * @param hasOverlayColor - Whether verse has overlay-provided color
 * @returns Highlighted color
 */
export function applyHoverHighlight(
  baseColor: [number, number, number] | [number, number, number][],
  hasOverlayColor: boolean,
): [number, number, number] | [number, number, number][] {
  if (hasOverlayColor) {
    // Brighten overlay-colored verses by 1.5x
    if (Array.isArray(baseColor[0])) {
      // Array of colors (multi-color verse)
      return (baseColor as [number, number, number][]).map(
        (c) =>
          [
            Math.min(1, c[0] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
            Math.min(1, c[1] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
            Math.min(1, c[2] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
          ] as [number, number, number],
      );
    } else {
      // Single color
      const c = baseColor as [number, number, number];
      return [
        Math.min(1, c[0] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
        Math.min(1, c[1] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
        Math.min(1, c[2] * HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR),
      ];
    }
  } else {
    // Replace background verses with highlight color
    return HIGHLIGHT_CONSTANTS.HIGHLIGHT_COLOR;
  }
}

/**
 * Compute semantic state for all items.
 * First pass: determine what is true about each item (hasOverlayColor, resolvedColor, isHovered, isPinned).
 * Returns array parallel to items array.
 *
 * Equality is injected as a parameter because each corpus has its own
 * identity shape. Tanakh callers pass versesEqual; Talmud callers pass
 * their equivalent.
 */
export function computeVerseStates<T>(
  items: SpatialItem<T>[],
  overlay: Overlay<T> | null,
  hoveredItem: SpatialItem<T> | null,
  pinnedItem: SpatialItem<T> | null,
  itemsEqual: (a: T | null, b: T | null) => boolean,
): VerseState[] {
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
 * Apply colors based on computed states.
 * Second pass: apply base colors, then hover highlighting.
 * Returns immutable color array parallel to verse states.
 *
 * @param verseStates - Pre-computed verse states
 * @returns Array of final colors for each verse
 */
export function applyVerseColors(
  verseStates: VerseState[],
): ([number, number, number] | [number, number, number][])[] {
  return verseStates.map((state) => {
    // Start with base color
    let finalColor = state.resolvedColor;

    // Apply hover highlighting if this verse is hovered
    if (state.isHovered) {
      finalColor = applyHoverHighlight(finalColor, state.hasOverlayColor);
    }

    return finalColor;
  });
}
