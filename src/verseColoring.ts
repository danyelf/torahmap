// Verse Coloring module - handles verse color computation and highlighting

import type { Verse, VerseState } from './types';
import type { Overlay } from './overlays/types';
import { seededRandom } from './utils/random';
import { HIGHLIGHT_CONSTANTS } from './constants';

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
 * Get overlay-provided color for a verse, or null if overlay doesn't color it.
 *
 * @param overlay - Active overlay (or null)
 * @param verse - Verse to get color for
 * @returns Color from overlay, or null if overlay doesn't provide color
 */
export function getOverlayColor(
  overlay: Overlay | null,
  verse: Verse
): [number, number, number] | [number, number, number][] | null {
  return overlay?.getVerseColor(verse) ?? null;
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
  hasOverlayColor: boolean
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
          ] as [number, number, number]
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
 * Compute semantic state for all verses.
 * First pass: determine what is true about each verse (hasOverlayColor, baseColor, isHovered, isPinned)
 * Returns array parallel to verses array.
 *
 * @param verses - All verses
 * @param overlay - Active overlay (or null)
 * @param hoveredVerse - Currently hovered verse (or null)
 * @param pinnedVerse - Currently pinned verse (or null)
 * @returns Array of verse states
 */
export function computeVerseStates(
  verses: Verse[],
  overlay: Overlay | null,
  hoveredVerse: Verse | null,
  pinnedVerse: Verse | null
): VerseState[] {
  return verses.map((v, i) => {
    const overlayColor = getOverlayColor(overlay, v);
    const hasOverlayColor = overlayColor !== null;
    const baseColor = hasOverlayColor ? overlayColor : getDefaultColor(i);

    const isHovered =
      hoveredVerse !== null &&
      hoveredVerse.book === v.book &&
      hoveredVerse.chapter === v.chapter &&
      hoveredVerse.verse === v.verse;

    const isPinned =
      pinnedVerse !== null &&
      pinnedVerse.book === v.book &&
      pinnedVerse.chapter === v.chapter &&
      pinnedVerse.verse === v.verse;

    return {
      hasOverlayColor,
      baseColor,
      isHovered,
      isPinned,
    };
  });
}

/**
 * Apply colors to verses based on computed states.
 * Second pass: apply base colors, then hover highlighting.
 * Mutates the verses array in place.
 *
 * @param verses - Verses to color (mutated in place)
 * @param verseStates - Pre-computed verse states
 */
export function applyVerseColors(
  verses: Verse[],
  verseStates: VerseState[]
): void {
  verses.forEach((v, i) => {
    const state = verseStates[i];

    // Start with base color
    let finalColor = state.baseColor;

    // Apply hover highlighting if this verse is hovered
    if (state.isHovered) {
      finalColor = applyHoverHighlight(finalColor, state.hasOverlayColor);
    }

    v.color = finalColor;
  });
}
