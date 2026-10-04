// Colour computation for spatial items

import type { Color, SpatialItem, VerseColor } from './types';
import type { Overlay, ToolOnMap, Tools } from './overlays/types';
import type { Picture } from './geometry';
import type { ColorSource } from './scrollytelling/driver';
import { sameItem } from './items.ts';
import { seededRandom } from './utils/random';
import { brighten } from './utils/color';
import { HIGHLIGHT_CONSTANTS, SEARCH_WITH_OVERLAY, DIMMED_GREY } from './constants';

/**
 * Default gray for a verse with no overlay color, brightness-varied by a
 * seeded random to reduce moiré.
 */
export function getDefaultColor(verseIndex: number): Color {
  const brightness =
    HIGHLIGHT_CONSTANTS.MIN_BRIGHTNESS +
    seededRandom(verseIndex * 3) * HIGHLIGHT_CONSTANTS.BRIGHTNESS_RANGE;
  return [brightness, brightness, brightness];
}

function brightenBands(color: VerseColor, factor: number): VerseColor {
  const one = (c: Color): Color => brighten(c, factor);
  return Array.isArray(color[0]) ? (color as Color[]).map(one) : one(color as Color);
}

/**
 * The map's colours from its two layers, search over overlay. `search` is null
 * with no search on and `overlay` null with no overlay; a null colour is
 * painted grey by fillDefaultColors.
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
 * `picture` with every null colour replaced by its square's base colour, the
 * default grey unless the text gives one, and marked `uncoloured` for the
 * hover. A cross-fade needs them so a still-uncoloured square blends from its
 * own colour rather than mergePictures's placeholder for "nothing here".
 */
export function fillDefaultColors(
  picture: Picture<VerseColor | null>,
  base: (index: number) => VerseColor = getDefaultColor,
): Picture<VerseColor> {
  return {
    ...picture,
    colors: picture.colors.map((c, i) => c ?? base(i)),
    uncoloured: picture.colors.map((c) => c === null),
  };
}

/** A settled overlay's colours, one entry per item. */
export function overlayColorsFor<T, S, D>(
  overlay: Overlay<T, S, D> | null,
  items: SpatialItem<T>[],
  settings: S,
  hovered: SpatialItem<T> | null,
  data: D,
): (VerseColor | null)[] {
  return overlay ? overlay.colorsFor(items, settings, hovered, data) : items.map(() => null);
}

/** The map's colours for the tools a view shows. `nonMatchDim` passes through to combineLayers. */
export function toolsPicture<T>(
  tools: Tools<T>,
  items: SpatialItem<T>[],
  hovered: SpatialItem<T> | null,
  nonMatchDim?: number,
): Picture<VerseColor | null> {
  const colorsOf = (on: ToolOnMap<T> | null) =>
    on && overlayColorsFor(on.tool, items, on.settings, hovered, on.data);
  return combineLayers(items.length, colorsOf(tools.search), colorsOf(tools.overlay), nonMatchDim);
}

/**
 * Which colour layer a move of the hovered verse makes stale: a story
 * transition's blend, the settled overlay's colours if they depend on the
 * hover, or neither. A timed ease blends colours captured when it began,
 * and a pin leaves the hover where it was, so neither recomputes anything.
 */
export function layerToRecompute<T>(
  source: ColorSource,
  overlay: ToolOnMap<T> | null,
  before: SpatialItem<T> | null,
  after: SpatialItem<T> | null,
): 'blend' | 'overlay' | null {
  if (sameItem(before, after) || source === 'ease') return null;
  if (source === 'blend') return 'blend';
  return overlay?.tool.hoverChangesColors?.(before, after, overlay.settings, overlay.data)
    ? 'overlay'
    : null;
}
