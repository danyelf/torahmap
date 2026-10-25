// What the colour testbed shows. Edit this file and the open page reloads.
//
// A colour is '#rrggbb' or 'oklch(L C H)': lightness 0 to 1, chroma about 0 to 0.4, hue in degrees.
// Each palette is a row; each block size is a column, and the row shows every colour of the
// palette at that size, side by side.

export interface BlockSize {
  /** Squares across and down. */
  w: number;
  h: number;
}

export interface Palette {
  name: string;
  colors: readonly string[];
}

export const BLOCK_SIZES: readonly BlockSize[] = [
  { w: 1, h: 1 },
  { w: 2, h: 2 },
  { w: 4, h: 4 },
  { w: 8, h: 8 },
  { w: 1, h: 16 },
];

export const PALETTES: readonly Palette[] = [
  {
    name: 'Categorical',
    colors: [
      '#e69f00',
      '#56b4e9',
      '#009e73',
      '#f0e442',
      '#0072b2',
      '#d55e00',
      '#cc79a7',
      '#999999',
    ],
  },
  {
    name: 'Sequential (stepped lightness)',
    colors: [
      'oklch(0.95 0.04 255)',
      'oklch(0.85 0.09 255)',
      'oklch(0.75 0.13 255)',
      'oklch(0.65 0.14 255)',
      'oklch(0.55 0.13 255)',
      'oklch(0.45 0.09 255)',
      'oklch(0.35 0.04 255)',
    ],
  },
  {
    name: 'Equal lightness, eight hues',
    colors: [
      'oklch(0.7 0.12 20)',
      'oklch(0.7 0.12 65)',
      'oklch(0.7 0.12 110)',
      'oklch(0.7 0.12 155)',
      'oklch(0.7 0.12 200)',
      'oklch(0.7 0.12 245)',
      'oklch(0.7 0.12 290)',
      'oklch(0.7 0.12 335)',
    ],
  },
  {
    name: 'Muted next to saturated',
    colors: [
      'oklch(0.7 0.15 30)',
      'oklch(0.7 0.02 30)',
      'oklch(0.7 0.15 145)',
      'oklch(0.7 0.02 145)',
      'oklch(0.7 0.15 255)',
      'oklch(0.7 0.02 255)',
    ],
  },
];
