// src/constants.ts
// Global constants for the application

import type { Color } from './overlays/types.ts';
import { currentTheme } from './themes.ts';

/**
 * Highlight and rendering constants.
 *
 * Color-bearing fields are sourced from `currentTheme` (see src/themes.ts).
 * Non-color constants (radii, factors, thicknesses) stay as literals because
 * they don't vary by palette.
 */
export const HIGHLIGHT_CONSTANTS = {
  // Non-color constants — palette-agnostic, stay as literals
  FUZZY_RADIUS: 10,
  BLEED_PIXELS: 3,
  OUTLINE_THICKNESS: 2,
  DIM_FACTOR: 0.3,
  BRIGHTNESS_FACTOR: 1.5,
  DESATURATE_FACTOR: 0.2,

  // Color-bearing fields sourced from currentTheme. BRIGHTNESS_RANGE is
  // computed from dust.max - dust.min; the result drifts from the literal
  // 0.42 by ~5e-17 due to IEEE 754, which is invisible after 8-bit color
  // quantization and unobservable by callers (seededRandom returns [0,1),
  // so the upper bound is never exactly hit). Tests use toBeCloseTo.
  MIN_BRIGHTNESS: currentTheme.dust.min,
  BRIGHTNESS_RANGE: currentTheme.dust.max - currentTheme.dust.min,
  CANVAS_BG_COLOR: currentTheme.bg,
  DIM_BRIGHTNESS: currentTheme.dim,
  OUTLINE_COLOR: currentTheme.outlines.default,
  HIGHLIGHT_COLOR: currentTheme.outlines.pin,
  PINNED_OUTLINE_COLOR: currentTheme.outlines.pin,
  HOVER_OUTLINE_COLOR: currentTheme.outlines.hover,
  HOVER_WHILE_PINNED_OUTLINE_COLOR: currentTheme.outlines.hoverWhilePinned,
  RARE_NO_MATCH_COLOR: [0.25, 0.25, 0.25] as Color, // intentionally palette-agnostic (see Task 14)
} as const;
