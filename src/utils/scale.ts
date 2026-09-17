import { interpolateGradient, type ColorStop } from './color.ts';
import type { Color } from '../overlays/types.ts';

/** Maps a value onto the 0..1 position it occupies on a scale. */
export type Transform = (value: number) => number;

export const LOG: Transform = (value) => Math.log(value + 1);
export const SQRT: Transform = Math.sqrt;

export interface Scale {
  positionOf(value: number): number;
  colorOf(value: number): Color;
  palette: ColorStop[];
}

export function scale(
  low: number,
  high: number,
  transform: Transform,
  palette: ColorStop[],
): Scale {
  const start = transform(low);
  const span = transform(high) - start;

  const positionOf = (value: number) => (span === 0 ? 0 : (transform(value) - start) / span);

  return {
    positionOf,
    colorOf: (value) => interpolateGradient(positionOf(value), palette),
    palette,
  };
}
