// Talmud-specific layout and color constants.

import type { BookTab, SectionLabelSize, SectionName } from '@torahmap/shell/mapLabels.ts';

export const SEGMENT_SIZE = 6; // px per segment square

// --- Labels ---

// The perek names and the first daf numbers show from PEREK_LABEL_ZOOM; every daf from
// DAF_LABEL_ZOOM_ALL.
export const PEREK_LABEL_ZOOM = 0.7;
export const DAF_LABEL_ZOOM_ALL = 1.5;

// A perek name's size at zoom 1, and the bounds it is held between, in pixels.
export const PEREK_SIZE = { base: 9, min: 7, max: 18 };

// A daf number is a fixed size, in pixels, set this far right of its column. The widest, "144b",
// is 22 wide.
export const DAF_LABEL = { fontSize: 9, offset: 4, maxWidth: 22 };

// Room for the daf numbers beside a column and below a shelf's last row, in map units, at
// PEREK_LABEL_ZOOM, where they are largest on the map.
export const DAF_LABEL_ROOM = {
  right: Math.ceil((DAF_LABEL.offset + DAF_LABEL.maxWidth) / PEREK_LABEL_ZOOM),
  below: Math.ceil(DAF_LABEL.fontSize / PEREK_LABEL_ZOOM - SEGMENT_SIZE),
};

// --- Layout constants ---

export const PEREK_GAP = 30; // vertical gap between perakim within a tractate
export const TRACTATE_GAP = 90; // horizontal gap between tractates on a shelf (extra room now that wide tractates wrap into multi-column blocks)
export const SEDER_GAP = 120; // vertical gap between shelves (sedarim)
// A tractate's name, a tab above its first row that scales with the map. It fades out below the
// perek names' smallest size. At 17, the tightest fit, Horayot's, has 15 units to spare inside its
// tractate, and 7 at the smallest zoom it shows at. Its line box ends 20 units above the first
// row, clear of the first perek's name, which is at most 12 tall and ends 2 above that row.
export const TRACTATE_TAB: BookTab = { fontSize: 17, above: 40, inset: 6, minPx: PEREK_SIZE.min };
// The tab, and 4 units above it.
export const TRACTATE_LABEL_HEIGHT = TRACTATE_TAB.above + 4;

// Tractates taller than this row count get wrapped into multiple columns
// inside their own block. (Shabbat, Yevamot, Bava Batra, Sanhedrin, etc.)
// The threshold is in *display rows*, which roughly corresponds to half-
// dapim plus a few perek-boundary splits.
export const TRACTATE_WRAP_ROWS = 50;
// Between a tractate's columns: room for the daf numbers beside a column, then 14 more.
export const TRACTATE_COLUMN_GAP = DAF_LABEL_ROOM.right + 14;

// --- The sedarim ---

/**
 * A seder: its name in the data, and in Hebrew and English beside its shelf, and the tint behind
 * its shelf, red, green and blue from 0 to 1.
 */
export interface Seder extends SectionName {
  name: string;
  tint: readonly [number, number, number];
}

const seder = (name: string, he: string, tint: Seder['tint']): Seder => ({
  name,
  he,
  en: name.replace(/^Seder /, ''),
  tint,
});

// In shelf order, top to bottom. The tints are muted but distinct enough to read against the dark
// canvas and the squares' colours; near-white ones (0.97 and up) are invisible there.
export const SEDARIM: readonly Seder[] = [
  seder('Seder Zeraim', 'זרעים', [0.45, 0.65, 0.4]), // green
  seder('Seder Moed', 'מועד', [0.35, 0.55, 0.85]), // blue
  seder('Seder Nashim', 'נשים', [0.85, 0.5, 0.55]), // rose
  seder('Seder Nezikin', 'נזיקין', [0.85, 0.7, 0.3]), // amber
  seder('Seder Kodashim', 'קדשים', [0.55, 0.4, 0.75]), // violet
  seder('Seder Tahorot', 'טהרות', [0.4, 0.75, 0.75]), // teal
];

// The seder labels' size. At 56 the longest, Kodashim's, runs 480 units down a
// shelf that is 620 from the next; Nezikin's, 390 of 535. The gap clears the daf
// labels beside each shelf's first tractate, which show from PEREK_LABEL_ZOOM.
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

// The tints are drawn over the canvas at this opacity.
export const SEDER_BACKGROUND_OPACITY = 0.1;
