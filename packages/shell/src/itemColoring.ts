// Colour computation for spatial items

import { type SpatialItem, type ItemColor, type Picture, sameItem } from '@torahmap/engine';
import { type Color, brighten } from '@torahmap/utils';
import type { Overlay, ToolOnMap, Tools } from './overlays/types';
import type { ColorSource } from './scrollytelling/driver';
import { SEARCH_NON_MATCH_DIM, DIMMED_GREY } from './constants';

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
 * search leads, 1 while the overlay leads; it does nothing with search alone.
 * With both on, a square neither colours dims from its `base` colour. With
 * search alone, a square it does not find keeps `keepsBase` of its base
 * colour, or goes grey without it. Every match stands out, so it shows at any
 * zoom, and so does every square `overlayStandout` marks; `overlayHalo` keeps a
 * faint glow on some of those at every zoom.
 */
export function combineLayers(
  count: number,
  search: readonly (ItemColor | null)[] | null,
  overlay: readonly (ItemColor | null)[] | null,
  base: (index: number) => ItemColor,
  nonMatchDim: number = SEARCH_NON_MATCH_DIM,
  keepsBase?: number,
  overlayStandout?: readonly boolean[] | null,
  overlayHalo?: readonly boolean[] | null,
): Picture<ItemColor | null> {
  const colors: (ItemColor | null)[] = new Array(count);
  const rings: (ItemColor | null)[] = new Array(count).fill(null);
  const standout: boolean[] | undefined = search || overlayStandout ? new Array(count) : undefined;

  for (let i = 0; i < count; i++) {
    const under = overlay?.[i] ?? null;
    const match = search?.[i] ?? null;
    if (standout) standout[i] = !!match || !!overlayStandout?.[i];
    if (!search) {
      colors[i] = under;
    } else if (!overlay) {
      colors[i] =
        match ?? (keepsBase === undefined ? DIMMED_GREY : brightenBands(base(i), keepsBase));
    } else if (match) {
      colors[i] = under;
      rings[i] = match;
    } else {
      colors[i] = brightenBands(under ?? base(i), nonMatchDim);
    }
  }

  const picture: Picture<ItemColor | null> = search && overlay ? { colors, rings } : { colors };
  if (standout) picture.standout = standout;
  if (overlayHalo) picture.halo = [...overlayHalo];
  return picture;
}

/**
 * `picture` with every null colour replaced by its square's base colour, and
 * marked `uncoloured` for the hover. A cross-fade needs them so a still-uncoloured square blends from its
 * own colour rather than mergePictures's placeholder for "nothing here".
 * With `baseRing`, a square the picture gives no ring takes its base ring.
 */
export function fillDefaultColors(
  picture: Picture<ItemColor | null>,
  base: (index: number) => ItemColor,
  baseRing?: (index: number) => ItemColor | null,
): Picture<ItemColor> {
  return {
    ...picture,
    ...(baseRing && {
      rings: picture.colors.map((_, i) => picture.rings?.[i] ?? baseRing(i)),
    }),
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
  keepsBase?: number,
): Picture<ItemColor | null> {
  const colorsOf = (on: ToolOnMap<T> | null) =>
    on && overlayColorsFor(on.tool, items, on.settings, hovered, on.data);
  const { overlay } = tools;
  return combineLayers(
    items.length,
    colorsOf(tools.search),
    colorsOf(overlay),
    base,
    nonMatchDim,
    keepsBase,
    overlay?.tool.standoutsFor?.(items, overlay.settings, overlay.data),
    overlay?.tool.halosFor?.(items, overlay.settings, overlay.data),
  );
}

/**
 * Which colour layer a move of the hovered square makes stale: a story
 * transition's blend, the settled overlay's colours if they depend on the
 * focus (the hovered square, else the pinned one), or neither. A timed ease
 * blends colours captured when it began, so it recomputes nothing.
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
