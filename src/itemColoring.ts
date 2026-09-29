// Color computation and hover highlighting for spatial items

import type { SpatialItem, ItemState } from './types';
import type { Overlay, Color, ToolOnMap, Tools } from './overlays/types';
import type { Picture } from './geometry';
import { seededRandom } from './utils/random';
import { brighten } from './utils/color';
import { HIGHLIGHT_CONSTANTS, SEARCH_WITH_OVERLAY, DIMMED_GREY } from './constants';

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

/** A verse's colour, or its stripes. */
export type VerseColor = Color | Color[];

function brightenBands(color: VerseColor, factor: number): VerseColor {
  const one = (c: Color): Color => brighten(c, factor);
  return Array.isArray(color[0]) ? (color as Color[]).map(one) : one(color as Color);
}

/**
 * The map's colours from its two layers, search over overlay. `search` is null
 * with no search on and `overlay` null with no overlay; a null colour is
 * painted grey by computeItemStates.
 *
 * `nonMatchDim` is how much of the overlay colour a non-match keeps when both
 * layers are on: `SEARCH_WITH_OVERLAY.NON_MATCH_DIM` (the default) while
 * search leads, 1 while the overlay leads; it does nothing with search alone,
 * which always dims to its own grey.
 */
export function combineLayers(
  count: number,
  search: readonly (VerseColor | null)[] | null,
  overlay: readonly (VerseColor | null)[] | null,
  nonMatchDim: number = SEARCH_WITH_OVERLAY.NON_MATCH_DIM,
): Picture<VerseColor | null> {
  const colors: (VerseColor | null)[] = new Array(count);
  const rings: (VerseColor | null)[] = new Array(count).fill(null);

  for (let i = 0; i < count; i++) {
    const under = overlay?.[i] ?? null;
    const match = search?.[i] ?? null;
    if (!search) {
      colors[i] = under;
    } else if (!overlay) {
      colors[i] = match ?? DIMMED_GREY;
    } else if (match) {
      colors[i] = under;
      rings[i] = match;
    } else {
      colors[i] = brightenBands(under ?? getDefaultColor(i), nonMatchDim);
    }
  }

  return search && overlay ? { colors, rings } : { colors };
}

/**
 * `picture` with every null colour replaced by its verse's default grey —
 * what a cross-fade needs so a still-uncoloured verse blends from its own
 * grey rather than mergePictures's placeholder for "nothing here".
 */
export function fillDefaultColors(picture: Picture<VerseColor | null>): Picture<VerseColor> {
  return { ...picture, colors: picture.colors.map((c, i) => c ?? getDefaultColor(i)) };
}

/**
 * Get overlay-provided color for a spatial item, or null if overlay doesn't color it.
 */
export function getOverlayColor<T, S>(
  overlay: Overlay<T, S> | null,
  item: T,
  settings: S,
): [number, number, number] | [number, number, number][] | null {
  return overlay?.getVerseColor(item, settings) ?? null;
}

/**
 * Apply hover highlighting to a verse color: overlay-colored verses brighten,
 * background verses (no overlay color) are replaced with the highlight color.
 */
export function applyHoverHighlight(baseColor: VerseColor, hasOverlayColor: boolean): VerseColor {
  return hasOverlayColor
    ? brightenBands(baseColor, HIGHLIGHT_CONSTANTS.BRIGHTNESS_FACTOR)
    : HIGHLIGHT_CONSTANTS.HIGHLIGHT_COLOR;
}

/**
 * A settled overlay's colours, one entry per item, as computeItemStates needs
 * them. Asks colorsFor where there is one, as the story's blend does, so the
 * two agree on a hovered verse.
 */
export function overlayColorsFor<T, S>(
  overlay: Overlay<T, S> | null,
  items: SpatialItem<T>[],
  settings: S,
  hovered: SpatialItem<T> | null,
): (Color | Color[] | null)[] {
  if (overlay?.colorsFor) return overlay.colorsFor(items, settings, hovered);
  return items.map((v) => getOverlayColor(overlay, v, settings));
}

/** The map's colours for the tools a view shows. `nonMatchDim` passes through to combineLayers. */
export function toolsPicture<T>(
  tools: Tools<T>,
  items: SpatialItem<T>[],
  hovered: SpatialItem<T> | null,
  nonMatchDim?: number,
): Picture<VerseColor | null> {
  const colorsOf = (on: ToolOnMap<T> | null) =>
    on && overlayColorsFor(on.tool, items, on.settings, hovered);
  return combineLayers(items.length, colorsOf(tools.search), colorsOf(tools.overlay), nonMatchDim);
}

/**
 * Which colour layer a move of the hovered verse makes stale: a story
 * transition's blend, the settled overlay's colours if they depend on the
 * hover, or neither. A timed ease blends colours captured when it began,
 * and a pin leaves the hover where it was, so neither recomputes anything.
 */
export function layerToRecompute<T, S>(
  source: 'overlay' | 'blend' | 'ease',
  overlay: Overlay<T, S> | null,
  settings: S,
  before: T | null,
  after: T | null,
  itemsEqual: (a: T | null, b: T | null) => boolean,
): 'blend' | 'overlay' | null {
  if (itemsEqual(before, after) || source === 'ease') return null;
  if (source === 'blend') return 'blend';
  return overlay?.hoverChangesColors?.(before, after, settings) ? 'overlay' : null;
}

/**
 * Compute semantic state for all items: what is true about each one
 * (hasOverlayColor, resolvedColor, isHovered, isPinned). Returns an array
 * parallel to items.
 *
 * Takes a colour per item rather than an overlay, so a blended colour array
 * composites the same way a settled overlay frame does; overlayColorsFor
 * builds that array from an overlay.
 *
 * Equality is injected as a parameter because each corpus has its own
 * identity shape. Tanakh callers pass tanakhIdentitiesEqual; Talmud callers pass
 * their equivalent.
 */
export function computeItemStates<T>(
  items: SpatialItem<T>[],
  overlayColors: (Color | Color[] | null)[],
  hoveredItem: SpatialItem<T> | null,
  pinnedItem: SpatialItem<T> | null,
  itemsEqual: (a: T | null, b: T | null) => boolean,
): ItemState[] {
  return items.map((v, i) => {
    const overlayColor = overlayColors[i];
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
