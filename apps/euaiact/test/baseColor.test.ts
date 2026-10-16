import { describe, expect, it } from 'vitest';
import { ARTICLE, layerColor } from '../src/baseColor.ts';
import { BRIGHTNESS_JITTER } from '../src/constants.ts';
import type { ActItem } from '../src/layout.ts';

const item = (id: string): ActItem => ({
  id,
  x: 0,
  y: 0,
  size: 6,
  layer: 'article',
  origin: 'B',
  lead: false,
  chapter: 'I',
});

describe('a square’s base colour', () => {
  it('varies by square, within the brightness range, the same every time', () => {
    const colours = ['1', '2', '3', '4', '5'].map((id) => layerColor(item(id)));
    expect(new Set(colours.map((c) => c[0])).size).toBeGreaterThan(1);
    for (const c of colours) {
      const f = c[0] / ARTICLE[0];
      expect(f).toBeGreaterThanOrEqual(1 - BRIGHTNESS_JITTER - 1e-9);
      expect(f).toBeLessThanOrEqual(1 + BRIGHTNESS_JITTER + 1e-9);
    }
    expect(layerColor(item('1'))).toEqual(colours[0]);
  });
});
