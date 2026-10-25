import { oklchToRgb, type Color } from '@torahmap/utils';

const OKLCH = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;

/** A colour from '#rrggbb' or 'oklch(L C H)'; throws on anything else, so a typo shows at once. */
export function parseColor(spec: string): Color {
  const text = spec.trim();
  if (/^#[0-9a-f]{6}$/i.test(text)) {
    return [1, 3, 5].map((i) => parseInt(text.slice(i, i + 2), 16) / 255) as Color;
  }
  const match = OKLCH.exec(text);
  if (match) return oklchToRgb(Number(match[1]), Number(match[2]), Number(match[3]));
  throw new Error(`Not a colour: ${spec}`);
}
