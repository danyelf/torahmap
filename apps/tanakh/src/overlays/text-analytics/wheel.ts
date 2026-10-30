// The verses of the Tanakh in reading order, and the colour wheel laid over the map: a verse's
// colour is the hue at its place, set by the direction from a centre near the end of II Kings.

import { type Color, memoByValue } from '@torahmap/utils';
import { verseId } from '@torahmap/link/tanakh';
import type { ScoresFile } from './scores.ts';
import type { TanakhLayout } from '../../types.ts';

export interface Place {
  id: string;
  book: string;
  chapter: number;
  verse: number;
}

/** Every verse from Genesis 1:1, and each verse's position by id. */
export const readingOrder = memoByValue((scores: ScoresFile) => {
  const places: Place[] = [];
  const positions = new Map<string, number>();
  for (const [book, chapters] of Object.entries(scores.repetition)) {
    for (const [chapter, verses] of Object.entries(chapters)) {
      for (let verse = 1; verse <= verses.length; verse++) {
        const id = verseId(book, Number(chapter), verse);
        positions.set(id, places.length);
        places.push({ id, book, chapter: Number(chapter), verse });
      }
    }
  }
  return { places, positions };
});

// Where the wheel's centre lies, as a share of the map's width and height.
const CENTRE = { x: 0.503, y: 0.508 };

// The hue circle is shared out among slices of angle (degrees clockwise from straight up, as seen
// from the centre) by weight, so the slices crowded with books get more hue: the Torah's, the
// Writings' side, and the stretch before the Twelve each stay distinct. The hue falls with angle.
const SLICES: [from: number, to: number, weight: number][] = [
  [8, 74.5, 150],
  [74.5, 90, 45],
  [90, 135, 45],
  [135, 232, 20],
  [232, 260, 35],
  [260, 274, 55],
  [274, 340, 10],
  [340, 368, 0],
];
const FIRST_HUE = 185;
const BLUR_DEGREES = 2.5;
const BINS_PER_DEGREE = 10;
const BINS = 360 * BINS_PER_DEGREE;

/** The hue, in OKLCH degrees, for each tenth of a degree of angle. */
const hueTable = memoByValue((slices: typeof SLICES) => {
  const weight = new Float64Array(BINS);
  for (const [from, to, share] of slices) {
    const bins: number[] = [];
    for (let i = 0; i < BINS; i++) {
      const angle = i / BINS_PER_DEGREE;
      if ((angle >= from && angle < to) || (angle + 360 >= from && angle + 360 < to)) bins.push(i);
    }
    for (const i of bins) weight[i] += share / bins.length;
  }
  // A Gaussian blur round the circle, so the hue has no seams.
  const sigma = BLUR_DEGREES * BINS_PER_DEGREE;
  const blurred = new Float64Array(BINS);
  for (let i = 0; i < BINS; i++) {
    for (let d = -4 * sigma; d <= 4 * sigma; d++) {
      blurred[i] += weight[(i + d + BINS) % BINS] * Math.exp(-(d * d) / (2 * sigma * sigma));
    }
  }
  const total = blurred.reduce((a, b) => a + b, 0);
  let run = 0;
  return Array.from(blurred, (share) => {
    const hue = (((FIRST_HUE - (360 * run) / total) % 360) + 360) % 360;
    run += share;
    return hue;
  });
});

const hueAtAngle = (degrees: number): number =>
  hueTable(SLICES)[
    Math.min(BINS - 1, Math.round((((degrees % 360) + 360) % 360) * BINS_PER_DEGREE))
  ];

/** Linear sRGB of an OKLCH colour, or null when it falls outside the screen's colours. */
function toSrgb(lightness: number, chroma: number, hue: number): Color | null {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  if (linear.some((c) => c < -0.0005 || c > 1.0005)) return null;
  return linear.map((c) => {
    const v = Math.min(1, Math.max(0, c));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  }) as Color;
}

/** The OKLCH colour, its chroma reduced until the screen can show it. */
function oklch(lightness: number, chroma: number, hue: number): Color {
  for (let c = chroma; c > 0; c -= 0.005) {
    const color = toSrgb(lightness, c, hue);
    if (color) return color;
  }
  return toSrgb(lightness, 0, hue)!;
}

const BRIGHT = { lightness: 0.78, chroma: 0.17 };
// Within this many map units of the centre a small step in place is a large step in angle, so the
// colour fades to grey there rather than jumping from verse to verse. Kings lies 200 to 570 out.
const CENTRE_FADE_RADIUS = 250;
// An echo this many map units away or more shows its full colour; nearer ones fade toward grey,
// since neighbouring verses with a short hop between them would otherwise differ in hue.
const ECHO_FADE_DISTANCE = 600;
const BACKDROP_OPACITY = 0.12;
const MARGIN = 400;

const css = (color: Color): string => `rgb(${color.map((c) => Math.round(c * 255)).join(',')})`;

/** The wheel over a map's squares: where its centre is, and the colour at any place. */
export const wheelOf = memoByValue((items: readonly TanakhLayout[]) => {
  let width = 0;
  let height = 0;
  const at = new Map<string, { x: number; y: number }>();
  for (const { id, x, y, size } of items) {
    width = Math.max(width, x + size);
    height = Math.max(height, y + size);
    at.set(id, { x: x + size / 2, y: y + size / 2 });
  }
  const centre = { x: CENTRE.x * width, y: CENTRE.y * height };
  const colors = new Map<string, Color>();
  return {
    centre,
    rect: { minX: -MARGIN, minY: -MARGIN, maxX: width + MARGIN, maxY: height + MARGIN },
    /** The map distance between the verses with these ids, or null if either is unknown. */
    distance(a: string, b: string): number | null {
      const from = at.get(a);
      const to = at.get(b);
      return from && to ? Math.hypot(from.x - to.x, from.y - to.y) : null;
    },
    /**
     * The colour at the place of the verse with this id, or null for an unknown verse. It fades
     * toward grey near the centre; given the map distance `reach` of an echo, it fades for a
     * short one too.
     */
    colorAt(id: string, reach?: number): Color | null {
      const place = at.get(id);
      if (!place) return null;
      const angle = (Math.atan2(place.x - centre.x, centre.y - place.y) * 180) / Math.PI;
      const hue = hueAtAngle(angle);
      const strength =
        Math.min(1, Math.hypot(place.x - centre.x, place.y - centre.y) / CENTRE_FADE_RADIUS) *
        (reach === undefined ? 1 : Math.min(1, reach / ECHO_FADE_DISTANCE));
      const chroma = Math.round(BRIGHT.chroma * strength * 1000) / 1000;
      const key = `${hue}:${chroma}`;
      if (!colors.has(key)) colors.set(key, oklch(BRIGHT.lightness, chroma, hue));
      return colors.get(key)!;
    },
  };
});

/** The wheel as CSS colours, one for each degree of angle. */
const stops = memoByValue((_slices: typeof SLICES) =>
  Array.from({ length: 360 }, (_, degree) =>
    css(oklch(BRIGHT.lightness, BRIGHT.chroma, hueAtAngle(degree))),
  ),
);
export const wheelStops = (): string[] => stops(SLICES);

/** The wheel as the field behind a map's squares. */
export function backdropOf(items: readonly TanakhLayout[]) {
  const { centre, rect } = wheelOf(items);
  return {
    rect,
    centre,
    stops: wheelStops(),
    opacity: BACKDROP_OPACITY,
    fade: { radius: CENTRE_FADE_RADIUS, color: css(oklch(BRIGHT.lightness, 0, 0)) },
  };
}
