import type { Color, ColorStop } from '@torahmap/utils';

/** A verse an overlay has no count for: nothing written about it, or no words. */
export const NO_DATA: Color = [0.15, 0.15, 0.2];

// Perceptually uniform and colorblind-friendly: purple -> pink -> orange -> yellow.
export const PLASMA_STOPS: ColorStop[] = [
  { t: 0.0, color: [13 / 255, 8 / 255, 135 / 255] }, // dark purple
  { t: 0.25, color: [126 / 255, 3 / 255, 168 / 255] }, // magenta
  { t: 0.5, color: [204 / 255, 71 / 255, 120 / 255] }, // pink/red
  { t: 0.75, color: [248 / 255, 149 / 255, 64 / 255] }, // orange
  { t: 1.0, color: [240 / 255, 249 / 255, 33 / 255] }, // yellow
];
