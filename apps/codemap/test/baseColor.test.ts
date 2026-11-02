import { describe, expect, it } from 'vitest';
import { BASE_GREY, baseColor } from '../src/baseColor.ts';
import { BRIGHTNESS_JITTER } from '../src/constants.ts';

describe('a bar’s base colour', () => {
  it('varies by bar, within the brightness range, the same every time', () => {
    const colours = ['a:1', 'a:2', 'b:1', 'b:2', 'c:9'].map(baseColor);
    expect(new Set(colours.map((c) => c[0])).size).toBeGreaterThan(1);
    for (const c of colours) {
      const f = c[0] / BASE_GREY[0];
      expect(f).toBeGreaterThanOrEqual(1 - BRIGHTNESS_JITTER - 1e-9);
      expect(f).toBeLessThanOrEqual(1 + BRIGHTNESS_JITTER + 1e-9);
    }
    expect(baseColor('a:1')).toEqual(colours[0]);
  });
});
