import { describe, expect, it } from 'vitest';
import { parseColor } from '../src/color.ts';
import { computeSwatchLayout } from '../src/layout.ts';
import { BLOCK_SIZES, PALETTES } from '../src/palettes.ts';

describe('parseColor', () => {
  it('reads hex and oklch, and refuses anything else', () => {
    expect(parseColor('#ff8000')).toEqual([1, 128 / 255, 0]);
    expect(parseColor('oklch(1 0 0)')[0]).toBeCloseTo(1, 2);
    expect(() => parseColor('red')).toThrow();
  });
});

describe('the palettes file', () => {
  it('holds only colours that parse', () => {
    for (const palette of PALETTES) for (const color of palette.colors) parseColor(color);
  });

  it('lays out one square per block cell, each with a distinct id', () => {
    const { items } = computeSwatchLayout(PALETTES, BLOCK_SIZES);
    const cells = PALETTES.reduce(
      (n, p) => n + p.colors.length * BLOCK_SIZES.reduce((m, s) => m + s.w * s.h, 0),
      0,
    );
    expect(items).toHaveLength(cells);
    expect(new Set(items.map((i) => i.id)).size).toBe(cells);
  });
});
