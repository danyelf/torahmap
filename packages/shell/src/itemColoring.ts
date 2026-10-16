// Colour computation for spatial items

import { type SpatialItem, type ItemColor, type Picture, sameItem } from '@torahmap/engine';
import { type Color, seededRandom, brighten } from '@torahmap/utils';
import type { Overlay, ToolOnMap, Tools } from './overlays/types';
import type { ColorSource } from './scrollytelling/driver';
import { DEFAULT_BRIGHTNESS, SEARCH_NON_MATCH_DIM, DIMMED_GREY } from './constants';

/**
 * Default gray for a square with no overlay color, brightness-varied by a
 * seeded random to reduce moiré.
 */
export function getDefaultColor(itemIndex: number): Color {
  const brightness =
    DEFAULT_BRIGHTNESS.MIN + seededRandom(itemIndex * 3) * DEFAULT_BRIGHTNESS.RANGE;
  return [brightness, brightness, brightness];
}

function brightenBands(color: ItemColor, factor: number): ItemColor {
  const one = (c: Color): Color => brighten(c, factor);
  return Array.isArray(color[0]) ? (color as Color[]).map(one) : one(color as Color);
}

/**
 * The map's colours from its two layers, search over overlay. `search` is null
 * with no search on and `overlay` null with no overlay; a null colour is
 * painted its base colour by fillDefaultColors.
 *
 * `nonMatchDim` is how much of the overlay colour a non-match keeps when both
 * layers are on: `SEARCH_NON_MATCH_DIM` (the default) while
 * search leads, 1 while the overlay leads; it does nothing with search alone,
 * which always dims to its own grey. With both on, a square neither colours
 * dims from its `base` colour. With search alone, a square it does not find
 * is `unfound`'s colour (unfoundColor).
 */
export function combineLayers(
  count: number,
  search: readonly (ItemColor | null)[] | null,
  overlay: readonly (ItemColor | null)[] | null,
  base: (index: number) => ItemColor,
  nonMatchDim: number = SEARCH_NON_MATCH_DIM,
  unfound: (index: number) => ItemColor = () => DIMMED_GREY,
): Picture<ItemColor | null> {
  const colors: (ItemColor | null)[] = new Array(count);
  const rings: (ItemColor | null)[] = new Array(count).fill(null);

  for (let i = 0; i < count; i++) {
    const under = overlay?.[i] ?? null;
    const match = search?.[i] ?? null;
    if (!search) {
      colors[i] = under;
    } else if (!overlay) {
      colors[i] = match ?? unfound(i);
    } else if (match) {
      colors[i] = under;
      rings[i] = match;
    } else {
      colors[i] = brightenBands(under ?? base(i), nonMatchDim);
    }
  }

  return search && overlay ? { colors, rings } : { colors };
}

/**
 * `picture` with every null colour replaced by its square's base colour, and
 * marked `uncoloured` for the hover. A cross-fade needs them so a still-uncoloured square blends from its
 * own colour rather than mergePictures's placeholder for "nothing here".
 */
export function fillDefaultColors(
  picture: Picture<ItemColor | null>,
  base: (index: number) => ItemColor,
): Picture<ItemColor> {
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
): (ItemColor | null)[] {
  return overlay ? overlay.colorsFor(items, settings, hovered, data) : items.map(() => null);
}

/** The map's colours for the tools a view shows. The colour arguments pass through to combineLayers. */
export function toolsPicture<T>(
  tools: Tools<T>,
  items: SpatialItem<T>[],
  hovered: SpatialItem<T> | null,
  base: (index: number) => ItemColor,
  nonMatchDim?: number,
  unfound?: (index: number) => ItemColor,
): Picture<ItemColor | null> {
  const colorsOf = (on: ToolOnMap<T> | null) =>
    on && overlayColorsFor(on.tool, items, on.settings, hovered, on.data);
  return combineLayers(
    items.length,
    colorsOf(tools.search),
    colorsOf(tools.overlay),
    base,
    nonMatchDim,
    unfound,
  );
}

/** What search alone draws a square it does not find as: grey, or `keepsBase` of its own colour. */
export function unfoundColor(
  base: (index: number) => ItemColor,
  keepsBase: number | undefined,
): (index: number) => ItemColor {
  return keepsBase === undefined ? () => DIMMED_GREY : (i) => brightenBands(base(i), keepsBase);
}

/**
 * Which colour layer a move of the hovered square makes stale: a story
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
