import type { Color } from '@torahmap/utils';

export const HIGHLIGHT_CONSTANTS = {
  // Fuzzy hit detection radius (world units / pixels at 1x zoom)
  FUZZY_RADIUS: 10,

  // Outline/border color for squares
  OUTLINE_COLOR: [0.6, 0.6, 0.6] as Color,

  // Highlight color for search/selection
  HIGHLIGHT_COLOR: [0.2, 0.9, 1.0] as Color,

  // Outline color for pinned squares. Violet, a hue (200-310 degrees) the
  // search colours keep clear of, and neither the white nor the gold of hover.
  PINNED_OUTLINE_COLOR: [0.72, 0.55, 1.0] as Color,

  // Outline color for hovered squares
  HOVER_OUTLINE_COLOR: [1.0, 1.0, 1.0] as Color,

  // Outline color for hovered squares when another square is pinned
  HOVER_WHILE_PINNED_OUTLINE_COLOR: [1.0, 0.8, 0.2] as Color,

  // Outline thickness (extends outside square bounds)
  OUTLINE_THICKNESS: 2,

  // Thinner than hover: the outline is drawn outside the square, so thickness 2
  // rings a 4-unit square with three times its own area and reads as a blob.
  PINNED_OUTLINE_THICKNESS: 1,

  // Brightness multiplier for an overlay-colored item on hover
  BRIGHTNESS_FACTOR: 1.5,
} as const;

/** What the map is cleared to, before any square is drawn; the page behind it reads it too. */
export const MAP_BACKGROUND: Color = [0.075, 0.075, 0.075];

/** The ring a picture draws around a square, judged by eye on the map. */
export const RINGS = {
  // In CSS pixels, outside the square and inside it
  RING_OUTSIDE_PX: 1.5,
  RING_INSIDE_PX: 1,
  // A square smaller than this on screen has no room for a hole and is filled
  // with its ring colour. Rings can touch where layout jitter brings squares
  // close, as the multi-colour growth already can.
  RING_MIN_SQUARE_PX: 8,
} as const;

/** Whether a square of this side, in map units, has room for a ring's hole at this zoom: the shader's `holes`. */
export const hasRingRoom = (side: number, zoom: number): boolean =>
  side * zoom >= RINGS.RING_MIN_SQUARE_PX;

/**
 * Squares smaller than START_PX on screen start widening into bars, and reach
 * their row neighbour at FULL_PX. In device pixels, as the flicker and merging
 * that bars replace come from the pixel grid.
 */
export const BARS = {
  START_PX: 2,
  FULL_PX: 1.5,
} as const;

/** A square that stands out is never drawn smaller than this a side, in CSS pixels. */
export const STANDOUT_MIN_PX = 4;

/**
 * Below STANDOUT_MIN_PX a standout is a dot: a solid core, in a glow that
 * starts at ALPHA and fades out by SIDE_PX across, in CSS pixels. Solid
 * squares that size merge into blocks where hits are close; dots stay apart.
 */
export const STANDOUT_GLOW = {
  CORE_PX: 2.7,
  SIDE_PX: 7.6,
  ALPHA: 0.45,
} as const;

/**
 * A standout that has a halo and is at least STANDOUT_MIN_PX across is drawn
 * as it is, in a soft glow of its own color that starts at ALPHA and fades out
 * PX past its edge, in CSS pixels. Smaller, it is the glowing dot above.
 */
export const STANDOUT_HALO = {
  PX: 6,
  ALPHA: 0.5,
} as const;
