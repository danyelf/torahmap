import { describe, it, expect } from 'vitest';
import { getDefaultColor } from '../src/baseColor.ts';

describe('getDefaultColor', () => {
  const colors = Array.from({ length: 500 }, (_, i) => getDefaultColor(i));

  it('is a grey', () => {
    for (const [r, g, b] of colors) expect([g, b]).toEqual([r, r]);
  });

  it('stays between 0.4 and 0.8', () => {
    for (const [r] of colors) {
      expect(r).toBeGreaterThanOrEqual(0.4);
      expect(r).toBeLessThanOrEqual(0.8);
    }
  });

  it('varies from square to square, the same each time', () => {
    expect(new Set(colors.map((c) => c[0])).size).toBeGreaterThan(400);
    expect(getDefaultColor(3)).toEqual(getDefaultColor(3));
  });
});
