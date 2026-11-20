import { describe, it, expect } from 'vitest';
import { rgbToOklch } from '@torahmap/utils';
import { colorFor, freeColor, PALETTE, randomColor } from '../src/overlays/palette.ts';
import { MAX_PICKS } from '../src/overlays/picks.ts';

describe('the palette', () => {
  const colors = PALETTE.map((color) => rgbToOklch([...color]));

  it('makes every colour equally light', () => {
    for (const color of colors) expect(Math.abs(color.l - colors[0].l)).toBeLessThan(0.01);
  });

  it('keeps every colour inside what a screen shows', () => {
    for (const color of PALETTE) for (const channel of color) expect(channel).toBeGreaterThan(0);
    for (const color of PALETTE)
      for (const channel of color) expect(channel).toBeLessThanOrEqual(1);
  });

  it('keeps every colour well apart from every other', () => {
    const apart = (a: (typeof colors)[number], b: (typeof colors)[number]) => {
      const [ax, ay] = [
        a.c * Math.cos((a.h * Math.PI) / 180),
        a.c * Math.sin((a.h * Math.PI) / 180),
      ];
      const [bx, by] = [
        b.c * Math.cos((b.h * Math.PI) / 180),
        b.c * Math.sin((b.h * Math.PI) / 180),
      ];
      return Math.hypot(ax - bx, ay - by);
    };
    for (let a = 0; a < colors.length; a++)
      for (let b = a + 1; b < colors.length; b++)
        expect(apart(colors[a], colors[b])).toBeGreaterThan(0.06);
  });

  it('has a colour for every pick allowed', () => {
    expect(PALETTE.length).toBeGreaterThanOrEqual(MAX_PICKS);
  });

  it('puts a good distance of hue between each colour and the next, the last and first included', () => {
    const gap = (a: number, b: number) => {
      const turn = Math.abs(colors[a].h - colors[b].h) % 360;
      return Math.min(turn, 360 - turn);
    };
    for (let i = 0; i < colors.length; i++) {
      expect(gap(i, (i + 1) % colors.length)).toBeGreaterThanOrEqual(90);
    }
  });
});

describe('a word colour', () => {
  it('is the same every time, whatever else is taken that it does not use', () => {
    const own = colorFor('abraham', []);
    expect(colorFor('abraham', [])).toBe(own);
    expect(colorFor('abraham', [(own + 2) % PALETTE.length])).toBe(own);
  });

  it('steps to the next colour in the list when its own is taken, wrapping at the end', () => {
    const own = colorFor('abraham', []);
    expect(colorFor('abraham', [own])).toBe((own + 1) % PALETTE.length);
    const taken = [own, (own + 1) % PALETTE.length];
    expect(colorFor('abraham', taken)).toBe((own + 2) % PALETTE.length);
  });

  it('is never a taken colour while one is free', () => {
    for (const word of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      const taken = PALETTE.map((_, place) => place).filter((place) => place !== 3);
      expect(colorFor(word, taken)).toBe(3);
    }
  });

  it('is the word’s own when every colour is taken', () => {
    const all = PALETTE.map((_, place) => place);
    expect(colorFor('abraham', all)).toBe(colorFor('abraham', []));
  });
});

describe('the first free colour', () => {
  it('is the first when nothing is taken', () => {
    expect(freeColor([])).toBe(0);
  });

  it('skips the colours taken, wherever they are', () => {
    expect(freeColor([0, 2, 1])).toBe(3);
    expect(freeColor([1])).toBe(0);
  });

  it('falls back to the first when every colour is taken', () => {
    expect(freeColor(PALETTE.map((_, place) => place))).toBe(0);
  });
});

describe('a random colour', () => {
  it('is never one taken, and can be any of the rest', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 200; i++) seen.add(randomColor([0, 3]));
    expect([...seen].sort()).toEqual([1, 2, 4, 5]);
  });

  it('falls back to the first when every colour is taken', () => {
    expect(randomColor(PALETTE.map((_, place) => place))).toBe(0);
  });
});
