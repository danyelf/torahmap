// The verses of the Tanakh in reading order, and the spectrum laid along them: red at Genesis,
// orange at the end of the Torah, yellow to green through the Prophets, blue to purple through
// the Writings.

import { type Color, memoByValue } from '@torahmap/utils';
import { verseId } from '@torahmap/link/tanakh';
import type { ScoresFile } from './scores.ts';

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
  const bookStarts = new Map<string, number>();
  for (const [book, chapters] of Object.entries(scores.repetition)) {
    bookStarts.set(book, places.length);
    for (const [chapter, verses] of Object.entries(chapters)) {
      for (let verse = 1; verse <= verses.length; verse++) {
        const id = verseId(book, Number(chapter), verse);
        positions.set(id, places.length);
        places.push({ id, book, chapter: Number(chapter), verse });
      }
    }
  }
  return { places, positions, bookStarts };
});

// The hue, in OKLCH degrees, where each section starts and ends: the Torah runs red to orange, the
// Prophets yellow to green, and the Writings blue to purple, so no hue belongs to two sections.
const HUES = {
  torah: [25, 70],
  prophets: [95, 150],
  writings: [255, 320],
} as const;

const BRIGHT = { lightness: 0.78, chroma: 0.17 };

/** The Prophets begin at Joshua and the Writings at Psalms. */
const SECTION_STARTS = [
  { name: 'Torah', book: 'Genesis' },
  { name: 'Prophets', book: 'Joshua' },
  { name: 'Writings', book: 'Psalms' },
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

/** Every verse's colour on the spectrum, each book's middle colour, and where each section starts, 0 to 1. */
export const spectrumOf = memoByValue((scores: ScoresFile) => {
  const { places, bookStarts } = readingOrder(scores);
  const joshua = bookStarts.get('Joshua') ?? places.length;
  const psalms = bookStarts.get('Psalms') ?? places.length;

  const hueAt = (position: number): number => {
    const [[from, to], [first, last]] =
      position < joshua
        ? [[0, joshua - 1], HUES.torah]
        : position < psalms
          ? [[joshua, psalms - 1], HUES.prophets]
          : [[psalms, places.length - 1], HUES.writings];
    return first + ((position - from) / Math.max(1, to - from)) * (last - first);
  };

  const bright = places.map((_, p) => oklch(BRIGHT.lightness, BRIGHT.chroma, hueAt(p)));
  const starts = [...bookStarts.values(), places.length];
  const books: Record<string, Color> = {};
  [...bookStarts.keys()].forEach((book, i) => {
    books[book] = bright[Math.floor((starts[i] + starts[i + 1] - 1) / 2)];
  });
  return {
    bright,
    books,
    sections: SECTION_STARTS.map(({ name, book }) => ({
      name,
      at: (bookStarts.get(book) ?? 0) / (places.length - 1),
    })),
  };
});
