// Global constants for the application

import type { Color } from './overlays/types.ts';

export const HIGHLIGHT_CONSTANTS = {
  // Fuzzy hit detection radius (world units / pixels at 1x zoom)
  FUZZY_RADIUS: 10,

  // Default verse brightness range (random variation to reduce moiré)
  MIN_BRIGHTNESS: 0.4,
  BRIGHTNESS_RANGE: 0.4, // Result: 0.4 to 0.8

  // Outline/border color for verses
  OUTLINE_COLOR: [0.6, 0.6, 0.6] as Color,

  // Bleed distance for multicolor verses (pixels outside normal bounds)
  BLEED_PIXELS: 3,

  // Highlight color for search/selection
  HIGHLIGHT_COLOR: [0.2, 0.9, 1.0] as Color,

  // Outline color for pinned verses. Violet at about 263 degrees, which is the
  // one wide gap in SEARCH_COLORS: those run cyan 188, orange 30, yellow 60,
  // lime 96, pink 315, leaving 200-310 unused. Nothing a search paints can
  // collide with it, and it is neither the white nor the gold used for hover.
  PINNED_OUTLINE_COLOR: [0.72, 0.55, 1.0] as Color,

  // Outline color for hovered verses
  HOVER_OUTLINE_COLOR: [1.0, 1.0, 1.0] as Color,

  // Outline color for hovered verses when another verse is pinned
  HOVER_WHILE_PINNED_OUTLINE_COLOR: [1.0, 0.8, 0.2] as Color,

  // Outline thickness (extends outside verse bounds)
  OUTLINE_THICKNESS: 2,

  // The pinned outline is thinner than the hover one. A verse square is 4 units
  // across once the inter-verse gap is taken off, and the outline is drawn
  // entirely outside it, so thickness 2 makes an 8x8 footprint around a 4x4
  // square — three times the verse's own area, which reads as a blob rather
  // than a marker. At 1 the ring is 6x6 and the verse's own color still shows.
  PINNED_OUTLINE_THICKNESS: 1,

  // Dimming factor for non-highlighted verses
  DIM_FACTOR: 0.3,

  // Brightness multiplier for an overlay-colored item on hover
  BRIGHTNESS_FACTOR: 1.5,

  // Desaturation factor for haftarah non-hover
  DESATURATE_FACTOR: 0.2,

  // Color for rare trop marks with no matches
  RARE_NO_MATCH_COLOR: [0.25, 0.25, 0.25] as Color,
} as const;
