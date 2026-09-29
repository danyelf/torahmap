// Colours for ink on cream paper. The site's colour wheel is evenly spaced by
// the numbers, so on paper its yellows glare and its blues go dark; the
// readings here are evenly spaced in OKLCH, where equal numbers look equally
// bright.

import { hslToRgb } from '../../src/utils/color.ts';
import { seededRandom } from '../../src/utils/random.ts';

export const PAPER = '#f3ecdc';
export const INK = '#3a2e24';
export const INK_SOFT = '#7a6a58';

function hex(rgb: readonly number[]): string {
  return (
    '#' +
    rgb
      .map((c) =>
        Math.round(Math.min(1, Math.max(0, c)) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function oklchToSrgb(L: number, C: number, hue: number): number[] {
  const h = (hue * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(toSrgb);
}

/** An OKLCH colour as hex, its chroma lowered until sRGB can show it. */
export function oklch(L: number, C: number, hue: number): string {
  let rgb = oklchToSrgb(L, C, hue);
  while (rgb.some((c) => c < 0 || c > 1) && C > 0) {
    C = Math.max(0, C - 0.005);
    rgb = oklchToSrgb(L, C, hue);
  }
  return hex(rgb);
}

/** OKLab lightness of a hex colour: how light it looks, 0 to 1. */
export function oklabLightness(colour: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(colour.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

/** The readings in the site's order around the wheel, from red. */
export function readingColours(count: number): string[] {
  return Array.from({ length: count }, (_, i) => oklch(0.64, 0.16, 29 + (i / count) * 360));
}

// Unread verses vary in depth by verse, as the site's grey does, from the same seed.
const vary = (verseIndex: number) => seededRandom(verseIndex * 3);

/** A verse in no reading, on the haftarah print. */
export function walnut(verseIndex: number): string {
  return hex(hslToRgb({ h: 31, s: 0.28, l: 0.34 + vary(verseIndex) * 0.13 }));
}

/** A verse naming no one, on the search print. */
export function paleTaupe(verseIndex: number): string {
  return hex(hslToRgb({ h: 37, s: 0.13, l: 0.66 + vary(verseIndex) * 0.07 }));
}

/**
 * Abraham, Isaac, Jacob, Moses, David. The site gives the fifth term yellow;
 * yellow darkened for print turns olive, too close to Jacob's green, so David
 * is plum.
 */
export const NAME_HUES = [215, 50, 135, 355, 320] as const;

export function nameInk(i: number): string {
  return oklch(0.5, 0.15, NAME_HUES[i]);
}
