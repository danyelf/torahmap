// Talmud-specific layout and color constants.
// Tunable values for the tm-f28x integration.

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

export const MISHNAH_BASE_COLOR: readonly [number, number, number] = [0.48, 0.58, 0.82];
export const GEMARA_BASE_COLOR: readonly [number, number, number] = [0.58, 0.58, 0.58];

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

export const SEDER_BACKGROUND_COLORS: Readonly<Record<string, readonly [number, number, number]>> = {
  "Seder Zeraim":   [0.45, 0.65, 0.40], // green
  "Seder Moed":     [0.35, 0.55, 0.85], // blue
  "Seder Nashim":   [0.85, 0.50, 0.55], // rose
  "Seder Nezikin":  [0.85, 0.70, 0.30], // amber
  "Seder Kodashim": [0.55, 0.40, 0.75], // violet
  "Seder Tahorot":  [0.40, 0.75, 0.75], // teal
};

export const SEDER_BACKGROUND_OPACITY = 0.10;

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
