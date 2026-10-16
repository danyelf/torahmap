// A square's nudge in place and in brightness, fixed by a seed so it is the same on every load.

import type { Color } from './color.ts';
import { seededRandom } from './random.ts';

/** An offset of up to ±range on each axis. */
export function positionJitter(seed: number, range: number): { x: number; y: number } {
  return {
    x: (seededRandom(seed * 2) - 0.5) * 2 * range,
    y: (seededRandom(seed * 2 + 1) - 0.5) * 2 * range,
  };
}

/** The colour up to ±range lighter or darker; multiplied, so the hue holds. */
export function brightnessJitter(color: Color, seed: number, range: number): Color {
  const f = 1 + (seededRandom(seed) - 0.5) * 2 * range;
  return color.map((c) => Math.max(0, Math.min(1, c * f))) as Color;
}
