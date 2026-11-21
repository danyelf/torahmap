import { describe, it, expect } from 'vitest';
import { rgbToOklch } from '@torahmap/utils';
import { freeColor, PICK_PALETTE, TERM_PALETTE } from '../src/overlays/palette.ts';
import { MAX_PICKS } from '../src/overlays/picks.ts';

describe('the palette', () => {
  const PALETTE = [...TERM_PALETTE, ...PICK_PALETTE];
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
    expect(PICK_PALETTE.length).toBeGreaterThanOrEqual(MAX_PICKS);
  });
});

describe('the first free colour', () => {
  const SIZE = 5;

  it('is the first when nothing is taken', () => {
    expect(freeColor([], SIZE)).toBe(0);
  });

  it('skips the colours taken, wherever they are', () => {
    expect(freeColor([0, 2, 1], SIZE)).toBe(3);
    expect(freeColor([1], SIZE)).toBe(0);
  });

  it('looks from the place it is given, wrapping round', () => {
    expect(freeColor([4], SIZE, 4)).toBe(0);
    expect(freeColor([2], SIZE, 2)).toBe(3);
  });

  it('falls back to the place it started from when every colour is taken', () => {
    expect(freeColor([0, 1, 2, 3, 4], SIZE, 2)).toBe(2);
  });
});
