// Talmud-specific layout and color constants.
// Tunable values for the tm-f28x integration.

import { currentTheme, pick, type ThemedTable, type TalmudTheme } from '../themes.ts';
import type { Color } from '../overlays/types.ts';

// Refined-grey's Talmud values = the literals shipped before the registry refactor.
// They live inline here (not in src/themes.ts) so the Talmud color story stays
// co-located with the Talmud constants module.
const REFINED_GREY_TALMUD: TalmudTheme = {
  mishnahBase: [0.48, 0.58, 0.82],
  gemaraBase:  [0.58, 0.58, 0.58],
  sederBackgrounds: {
    'Seder Zeraim':   [0.45, 0.65, 0.40],
    'Seder Moed':     [0.35, 0.55, 0.85],
    'Seder Nashim':   [0.85, 0.50, 0.55],
    'Seder Nezikin':  [0.85, 0.70, 0.30],
    'Seder Kodashim': [0.55, 0.40, 0.75],
    'Seder Tahorot':  [0.40, 0.75, 0.75],
  },
  sederBackgroundOpacity: 0.10,
  segmentLength: { pale: [0.95, 0.95, 0.6], dark: [0.6, 0.15, 0.1] },
};

const TALMUD_TABLE: ThemedTable<TalmudTheme> = {
  byTheme: { 'refined-grey': REFINED_GREY_TALMUD },
  lightFallback: {
    // Mishnah/Gemara: deeper saturation so they read against cream; Mishnah
    // keeps its blue identity but moves toward indigo; Gemara becomes warm-dark grey.
    mishnahBase: [0.18, 0.28, 0.55],
    gemaraBase:  [0.28, 0.25, 0.22],
    // Seder backgrounds: darker tints at slightly higher opacity so they read
    // as tonal washes on cream rather than washing it out further.
    sederBackgrounds: {
      'Seder Zeraim':   [0.20, 0.40, 0.18],
      'Seder Moed':     [0.15, 0.30, 0.60],
      'Seder Nashim':   [0.55, 0.20, 0.28],
      'Seder Nezikin':  [0.60, 0.40, 0.10],
      'Seder Kodashim': [0.30, 0.18, 0.50],
      'Seder Tahorot':  [0.20, 0.45, 0.45],
    },
    sederBackgroundOpacity: 0.14,
    segmentLength: { pale: [0.40, 0.32, 0.10], dark: [0.55, 0.10, 0.05] },
  },
};

// Resolve once at module load; currentTheme is fixed for the page lifetime.
// currentTheme.talmud (per-theme override) wins over the table; pick() handles
// the remaining (table lookup → polarity fallback) resolution.
const talmud: TalmudTheme = currentTheme.talmud ?? pick(TALMUD_TABLE);

// --- Layout constants ---

export const SEGMENT_SIZE = 6;                   // px per segment square
export const PEREK_GAP = 30;                     // vertical gap between perakim within a tractate
export const TRACTATE_GAP = 90;                  // horizontal gap between tractates on a shelf (extra room now that wide tractates wrap into multi-column blocks)
export const SEDER_GAP = 120;                    // vertical gap between shelves (sedarim)
export const DAF_LABEL_COLUMN_WIDTH = 30;        // space reserved for daf labels on the right of each tractate
export const TRACTATE_LABEL_HEIGHT = 24;         // space above each tractate block for its Hebrew name label

// Tractates taller than this row count get wrapped into multiple columns
// inside their own block. (Shabbat, Yevamot, Bava Batra, Sanhedrin, etc.)
// The threshold is in *display rows*, which roughly corresponds to half-
// dapim plus a few perek-boundary splits.
export const TRACTATE_WRAP_ROWS = 50;
export const TRACTATE_COLUMN_GAP = 14;            // horizontal gap between wrap columns

// --- Canonical seder order (top-to-bottom shelf order) ---

export const SEDER_ORDER: readonly string[] = [
  "Seder Zeraim",
  "Seder Moed",
  "Seder Nashim",
  "Seder Nezikin",
  "Seder Kodashim",
  "Seder Tahorot",
];

// --- Base colors (muted, similar, "rainfall over both") ---
// MISHNAH = slate blue (brighter and more saturated than first pass so it
// reads against gemara grey), GEMARA = neutral grey.

export const MISHNAH_BASE_COLOR: Color = talmud.mishnahBase;
export const GEMARA_BASE_COLOR:  Color = talmud.gemaraBase;

// --- Per-segment brightness jitter ---
// Each segment gets a deterministic ±BRIGHTNESS_JITTER offset so the grid
// reads as living rainfall instead of flat tiles. The Torah map gets this
// for free via getDefaultColor() because all unhighlighted verses fall
// through there. The Talmud always paints via the M/G base overlay, so we
// need to mix the jitter into the overlay's output.

export const BRIGHTNESS_JITTER = 0.18;

// --- Per-segment positional jitter (±px) ---
// Tiny offset on each segment so the grid doesn't read as a perfect mesh.
// Mirrors the Torah map's ±1px JITTER_RANGE; smaller because Talmud
// SEGMENT_SIZE is 6 (vs 8 on the Torah side) and over-jitter at this size
// looks like noise rather than texture.
export const POSITION_JITTER = 0.7;

// --- Per-seder background tints ---
// Drawn as semi-transparent DOM overlays above the canvas (opacity =
// SEDER_BACKGROUND_OPACITY). Tints are intentionally muted but distinct
// enough to read against the dark canvas + flat verse colors. The first
// pass used near-white values (0.97...) which were invisible.

export const SEDER_BACKGROUND_COLORS: Readonly<Record<string, Color>> = talmud.sederBackgrounds;

export const SEDER_BACKGROUND_OPACITY = talmud.sederBackgroundOpacity;

// --- Zoom thresholds for daf label density ---
//   < LOW   no labels
//   < MID   every 10th daf (10a, 20a, …)
//   < HIGH  every 3rd daf  (3a, 6a, 9a, …)
//   >= HIGH every daf, both sides

export const DAF_LABEL_ZOOM_LOW = 0.3;
export const DAF_LABEL_ZOOM_MID = 0.7;
export const DAF_LABEL_ZOOM_HIGH = 1.5;

// --- Prefetch concurrency ---

export const PREFETCH_CONCURRENCY = 4;
