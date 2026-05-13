// src/constants.ts
// Global constants for the application

import type { Color } from './overlays/types.ts';

/**
 * Highlight and rendering constants
 */
export const HIGHLIGHT_CONSTANTS = {
  // Fuzzy hit detection radius (world units / pixels at 1x zoom)
  FUZZY_RADIUS: 10,

  // Default verse brightness range (random variation to reduce moiré).
  // Lifted from 0.40–0.80 so the dust separates more clearly from #1a1a1a.
  MIN_BRIGHTNESS: 0.50,
  BRIGHTNESS_RANGE: 0.42, // Result: 0.50 to 0.92

  // WebGL canvas clear color — must visually match the CSS body bg
  // (src/styles/main.css). Shows through gaps between verse squares.
  CANVAS_BG_COLOR: [0.102, 0.102, 0.102] as Color, // #1a1a1a

  // Uniform brightness for dimmed non-matching verses during active search.
  // Replaces the older `mid-brightness * DIM_FACTOR` multiplication, which
  // crushed verses to near-invisibility (rgb 46 against bg rgb 26).
  DIM_BRIGHTNESS: 0.30, // rgb 76 against bg rgb 26 — clearly visible, clearly dimmed

  // Outline/border color for verses
  OUTLINE_COLOR: [0.6, 0.6, 0.6] as Color,

  // Bleed distance for multicolor verses (pixels outside normal bounds)
  BLEED_PIXELS: 3,

  // Highlight color for search/selection
  HIGHLIGHT_COLOR: [0.2, 0.9, 1.0] as Color,

  // Outline color for pinned verses
  PINNED_OUTLINE_COLOR: [0.2, 0.9, 1.0] as Color,

  // Outline color for hovered verses
  HOVER_OUTLINE_COLOR: [1.0, 1.0, 1.0] as Color,

  // Outline color for hovered verses when another verse is pinned
  HOVER_WHILE_PINNED_OUTLINE_COLOR: [1.0, 0.8, 0.2] as Color,

  // Outline thickness (extends outside verse bounds)
  OUTLINE_THICKNESS: 2,

  // Dimming factor for non-highlighted verses
  DIM_FACTOR: 0.3,

  // Brightness adjustment for haftarah hover
  BRIGHTNESS_FACTOR: 1.5,

  // Desaturation factor for haftarah non-hover
  DESATURATE_FACTOR: 0.2,

  // Color for rare trop marks with no matches
  RARE_NO_MATCH_COLOR: [0.25, 0.25, 0.25] as Color,
} as const;
