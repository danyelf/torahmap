import { describe, expect, it } from 'vitest';
import {
  nameInk,
  NAME_HUES,
  oklabLightness,
  oklch,
  paleTaupe,
  readingColours,
  walnut,
} from '../colour.ts';

const HEX = /^#[0-9a-f]{6}$/;
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('oklch', () => {
  it('fits every hue into sRGB, even at a chroma sRGB cannot reach', () => {
    for (let h = 0; h < 360; h += 15) expect(oklch(0.64, 0.4, h)).toMatch(HEX);
  });

  it('keeps the lightness it was asked for', () => {
    for (let h = 0; h < 360; h += 15) {
      expect(oklabLightness(oklch(0.64, 0.16, h))).toBeCloseTo(0.64, 2);
    }
  });
});

describe('readingColours', () => {
  const colours = readingColours(83);

  it('gives every reading its own colour, all equally light', () => {
    expect(new Set(colours).size).toBe(83);
    for (const c of colours) expect(oklabLightness(c)).toBeCloseTo(0.64, 2);
  });

  it('starts from red, as the site does', () => {
    const [r, g, b] = rgb(colours[0]);
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
  });
});

describe('unread verses', () => {
  it('vary by verse, but the same verse always gets the same colour', () => {
    expect(walnut(7)).toBe(walnut(7));
    expect(new Set([0, 1, 2, 3, 4].map(walnut)).size).toBeGreaterThan(1);
  });

  it('are dark brown on the haftarah print and pale on the search print', () => {
    for (let i = 0; i < 50; i++) {
      expect(oklabLightness(walnut(i))).toBeLessThan(oklabLightness(paleTaupe(i)));
    }
  });
});

describe('nameInk', () => {
  it('gives each name a distinct dark ink', () => {
    const inks = NAME_HUES.map((_, i) => nameInk(i));
    expect(new Set(inks).size).toBe(NAME_HUES.length);
    for (const ink of inks) expect(oklabLightness(ink)).toBeLessThan(0.55);
  });
});
