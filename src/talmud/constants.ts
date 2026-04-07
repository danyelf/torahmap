// Talmud-specific layout and color constants.
// Tunable values for the tm-f28x integration.

// --- Layout constants ---

export const SEGMENT_SIZE = 6;                   // px per segment square
export const PEREK_GAP = 30;                     // vertical gap between perakim within a tractate
export const TRACTATE_GAP = 40;                  // horizontal gap between tractates on a shelf
export const SEDER_GAP = 120;                    // vertical gap between shelves (sedarim)
export const DAF_LABEL_COLUMN_WIDTH = 30;        // space reserved for daf labels on the right of each tractate
export const TRACTATE_LABEL_HEIGHT = 24;         // space above each tractate block for its Hebrew name label

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
// MISHNAH = slate blue, GEMARA = neutral grey. Tune during visual review.

export const MISHNAH_BASE_COLOR: readonly [number, number, number] = [0.42, 0.47, 0.58];
export const GEMARA_BASE_COLOR: readonly [number, number, number] = [0.55, 0.55, 0.55];

// --- Per-seder background tints (very subtle, ranging toward invisible) ---

export const SEDER_BACKGROUND_COLORS: Readonly<Record<string, readonly [number, number, number]>> = {
  "Seder Zeraim":   [0.97, 0.98, 0.96],
  "Seder Moed":     [0.96, 0.97, 0.98],
  "Seder Nashim":   [0.98, 0.97, 0.97],
  "Seder Nezikin":  [0.97, 0.97, 0.95],
  "Seder Kodashim": [0.96, 0.98, 0.97],
  "Seder Tahorot":  [0.98, 0.96, 0.97],
};

// --- Zoom thresholds for daf label density ---

export const DAF_LABEL_ZOOM_LOW = 0.3;
export const DAF_LABEL_ZOOM_HIGH = 1.5;

// --- Prefetch concurrency ---

export const PREFETCH_CONCURRENCY = 4;
