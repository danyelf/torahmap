// src/constants.ts
// Global constants for the application

import type { Color } from './overlays/types.ts';

/**
 * Highlight and rendering constants
 */
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

  // Outline color for pinned verses
  PINNED_OUTLINE_COLOR: [0.2, 0.9, 1.0] as Color,

  // Outline thickness (extends outside verse bounds)
  OUTLINE_THICKNESS: 2,

  // Dimming factor for non-highlighted verses
  DIM_FACTOR: 0.3,

  // Brightness adjustment for haftarah hover
  BRIGHTNESS_FACTOR: 1.5,

  // Desaturation factor for haftarah non-hover
  DESATURATE_FACTOR: 0.2,

  // Color for rare trop marks with no matches
  RARE_NO_MATCH_COLOR: [0.15, 0.15, 0.15] as Color,
} as const;
