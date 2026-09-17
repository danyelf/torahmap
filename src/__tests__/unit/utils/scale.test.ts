import { describe, it, expect } from 'vitest';
import { scale, LOG, SQRT } from '../../../utils/scale';
import type { ColorStop } from '../../../utils/color';

const BLACK_TO_WHITE: ColorStop[] = [
  { t: 0, color: [0, 0, 0] },
  { t: 1, color: [1, 1, 1] },
];

describe('scale', () => {
  it('puts the low end of the range at 0 and the high end at 1', () => {
    const s = scale(2, 36, SQRT, BLACK_TO_WHITE);

    expect(s.positionOf(2)).toBe(0);
    expect(s.positionOf(36)).toBe(1);
  });

  it('spaces a log scale by order of magnitude', () => {
    // Each power of ten lands a third of the way along a scale that tops out at
    // 1000, which is the spacing the commentary legend's ticks rely on.
    const s = scale(0, 1000, LOG, BLACK_TO_WHITE);

    expect(s.positionOf(9)).toBeCloseTo(1 / 3, 3);
    expect(s.positionOf(99)).toBeCloseTo(2 / 3, 3);
    expect(s.positionOf(1000)).toBeCloseTo(1, 3);
  });

  it('reads the colour off the palette at the value position', () => {
    const s = scale(0, 100, LOG, BLACK_TO_WHITE);

    // 9 sits halfway along a log scale that stops at 100, so halfway between
    // the two stops.
    const [r, g, b] = s.colorOf(9);
    expect(r).toBeCloseTo(0.5, 2);
    expect(g).toBeCloseTo(0.5, 2);
    expect(b).toBeCloseTo(0.5, 2);
  });
});
