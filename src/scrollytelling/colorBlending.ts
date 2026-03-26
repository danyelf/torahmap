// src/scrollytelling/colorBlending.ts
import { lerpColor } from './interpolation';

type Color = { r: number; g: number; b: number };

function toSingleColor(c: Color | Color[]): Color {
  if (!Array.isArray(c)) return c;
  if (c.length === 0) return { r: 0, g: 0, b: 0 };
  if (c.length === 1) return c[0];
  const sum = c.reduce(
    (acc, color) => ({ r: acc.r + color.r, g: acc.g + color.g, b: acc.b + color.b }),
    { r: 0, g: 0, b: 0 }
  );
  return { r: sum.r / c.length, g: sum.g / c.length, b: sum.b / c.length };
}

export function blendColorArrays(
  from: (Color | Color[])[],
  to: (Color | Color[])[],
  t: number
): Color[] {
  const len = Math.max(from.length, to.length);
  const result: Color[] = new Array(len);
  const defaultColor: Color = { r: 0.15, g: 0.15, b: 0.15 };

  for (let i = 0; i < len; i++) {
    const a = i < from.length ? toSingleColor(from[i]) : defaultColor;
    const b = i < to.length ? toSingleColor(to[i]) : defaultColor;
    result[i] = lerpColor(a, b, t);
  }

  return result;
}
