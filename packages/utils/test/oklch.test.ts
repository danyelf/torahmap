import { describe, expect, it } from 'vitest';
import { oklchToRgb } from '../src/oklch.ts';

describe('oklchToRgb', () => {
  it('maps zero chroma to a grey, and the lightness extremes to black and white', () => {
    const [r, g, b] = oklchToRgb(0.6, 0, 123);
    expect(r).toBeCloseTo(g, 3);
    expect(g).toBeCloseTo(b, 3);
    expect(oklchToRgb(1, 0, 0)[0]).toBeCloseTo(1, 2);
    expect(oklchToRgb(0, 0, 0)[0]).toBeCloseTo(0, 2);
  });

  it('puts hue 30 reddest and hue 145 greenest', () => {
    const red = oklchToRgb(0.63, 0.2, 30);
    const green = oklchToRgb(0.8, 0.2, 145);
    expect(red[0]).toBeGreaterThan(red[1]);
    expect(green[1]).toBeGreaterThan(green[0]);
  });

  it('keeps every channel inside 0 to 1, even for a colour sRGB cannot show', () => {
    for (const channel of oklchToRgb(0.7, 0.4, 150)) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });
});
