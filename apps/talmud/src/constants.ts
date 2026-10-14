// Talmud-specific layout and color constants.

import type { BookTab, SectionLabelSize } from '@torahmap/shell/mapLabels.ts';

// --- Layout constants ---

export const SEGMENT_SIZE = 6; // px per segment square
export const PEREK_GAP = 30; // vertical gap between perakim within a tractate
export const TRACTATE_GAP = 90; // horizontal gap between tractates on a shelf (extra room now that wide tractates wrap into multi-column blocks)
export const SEDER_GAP = 120; // vertical gap between shelves (sedarim)
// A tractate's name, a tab at the top-right of the band above its first row.
// It fades out below 7 pixels, the floor of the perek labels, the smallest
// Hebrew the map shows elsewhere; at 17 map units it reaches that at zoom 0.41.
// At 17, Horayot's name, the widest for its tractate's width of those that begin
// a shelf, fits inside it with 15 units to spare, 7 at the smallest zoom it shows
// at, where the text is set wider. The tab's 20-unit line box ends 20 units above
// the first row, clear of the first perek's label, which ends 2
// units above it and is at most 12 tall, at zoom 0.7, where it first shows.
export const TRACTATE_TAB: BookTab = { fontSize: 17, above: 40, inset: 6, minPx: 7 };
// The tab, and 4 units above it.
export const TRACTATE_LABEL_HEIGHT = TRACTATE_TAB.above + 4;

// Tractates taller than this row count get wrapped into multiple columns
// inside their own block. (Shabbat, Yevamot, Bava Batra, Sanhedrin, etc.)
// The threshold is in *display rows*, which roughly corresponds to half-
// dapim plus a few perek-boundary splits.
export const TRACTATE_WRAP_ROWS = 50;
export const TRACTATE_COLUMN_GAP = 14; // horizontal gap between wrap columns

// --- Canonical seder order (top-to-bottom shelf order) ---

export const SEDER_ORDER: readonly string[] = [
  'Seder Zeraim',
  'Seder Moed',
  'Seder Nashim',
  'Seder Nezikin',
  'Seder Kodashim',
  'Seder Tahorot',
];

// Each seder's label, beside its shelf.
export const SEDER_NAMES: Readonly<Record<string, { he: string; en: string }>> = {
  'Seder Zeraim': { he: 'זרעים', en: 'Zeraim' },
  'Seder Moed': { he: 'מועד', en: 'Moed' },
  'Seder Nashim': { he: 'נשים', en: 'Nashim' },
  'Seder Nezikin': { he: 'נזיקין', en: 'Nezikin' },
  'Seder Kodashim': { he: 'קדשים', en: 'Kodashim' },
  'Seder Tahorot': { he: 'טהרות', en: 'Tahorot' },
};

// The seder labels' size. At 56 the longest, Kodashim's, runs 480 units down a
// shelf that is 620 from the next; Nezikin's, 390 of 535. The gap clears the daf
// labels beside each shelf's first tractate, which show from zoom 0.3.
export const SEDER_LABEL_SIZE: SectionLabelSize = { fontSize: 56, gapEm: 1.5 };

// --- Base colors (muted, similar, "rainfall over both") ---
// MISHNAH = slate blue. GEMARA = a warm parchment, so it reads as coloured
// rather than as the grey of a square nothing colours.

export const MISHNAH_BASE_COLOR: readonly [number, number, number] = [0.48, 0.58, 0.82];
export const GEMARA_BASE_COLOR: readonly [number, number, number] = [0.66, 0.57, 0.42];

// --- Per-segment brightness jitter ---
// Each segment is a deterministic ±BRIGHTNESS_JITTER brighter or darker
// (baseColor.ts), so the grid reads as rainfall rather than flat tiles.

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
// enough to read against the dark canvas + flat square colors — near-white
// values (0.97+) are invisible there.

export const SEDER_BACKGROUND_COLORS: Readonly<Record<string, readonly [number, number, number]>> =
  {
    'Seder Zeraim': [0.45, 0.65, 0.4], // green
    'Seder Moed': [0.35, 0.55, 0.85], // blue
    'Seder Nashim': [0.85, 0.5, 0.55], // rose
    'Seder Nezikin': [0.85, 0.7, 0.3], // amber
    'Seder Kodashim': [0.55, 0.4, 0.75], // violet
    'Seder Tahorot': [0.4, 0.75, 0.75], // teal
  };

export const SEDER_BACKGROUND_OPACITY = 0.1;

// --- Zoom thresholds for daf label density ---
//   < LOW   no labels
//   < MID   every 10th daf (10a, 20a, …)
//   < HIGH  every 3rd daf  (3a, 6a, 9a, …)
//   >= HIGH every daf, both sides

export const DAF_LABEL_ZOOM_LOW = 0.3;
export const DAF_LABEL_ZOOM_MID = 0.7;
export const DAF_LABEL_ZOOM_HIGH = 1.5;
