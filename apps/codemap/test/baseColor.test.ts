import { describe, expect, it } from 'vitest';
import { BASE_GREY, baseColor } from '../src/baseColor.ts';
import { BRIGHTNESS_JITTER } from '../src/constants.ts';
import { computeCodeLayout } from '../src/layout.ts';
import { fixtureStructure } from './helpers/fixture.ts';

describe('a bar’s base colour', () => {
  it('varies by bar, within the brightness range, the same every time', () => {
    const items = computeCodeLayout(fixtureStructure).items;
    const colours = items.map(baseColor);
    expect(new Set(colours.map((c) => c[0])).size).toBeGreaterThan(1);
    for (const c of colours) {
      const f = c[0] / BASE_GREY[0];
      expect(f).toBeGreaterThanOrEqual(1 - BRIGHTNESS_JITTER - 1e-9);
      expect(f).toBeLessThanOrEqual(1 + BRIGHTNESS_JITTER + 1e-9);
    }
    expect(baseColor(items[0])).toEqual(colours[0]);
  });
});
