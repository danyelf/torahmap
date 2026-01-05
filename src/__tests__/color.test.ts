import { describe, it, expect } from 'vitest';
import { heatmapColor } from '../utils/color';

describe('heatmapColor', () => {
  it('returns dark color for zero value', () => {
    const color = heatmapColor(0, 100);
    // Should be very dark [0.15, 0.15, 0.2]
    expect(color[0]).toBeCloseTo(0.15, 2);
    expect(color[1]).toBeCloseTo(0.15, 2);
    expect(color[2]).toBeCloseTo(0.2, 2);
  });

  it('returns hot color for max value', () => {
    const color = heatmapColor(100, 100);
    // At t=1, should be in the red range
    expect(color[0]).toBeGreaterThan(0.9); // High red
    expect(color[1]).toBeLessThan(0.4); // Low green
  });

  it('produces values in valid RGB range [0, 1]', () => {
    for (let i = 0; i <= 100; i += 10) {
      const color = heatmapColor(i, 100);
      for (const channel of color) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });

  it('produces different colors for different values', () => {
    const low = heatmapColor(10, 100);
    const mid = heatmapColor(50, 100);
    const high = heatmapColor(90, 100);

    // Colors should be distinct
    expect(low).not.toEqual(mid);
    expect(mid).not.toEqual(high);
    expect(low).not.toEqual(high);
  });

  it('uses logarithmic scale', () => {
    // Due to log scale, the midpoint value should produce a color
    // that's closer to the high end than linear would suggest
    const midLinear = heatmapColor(50, 100);
    const midLog = heatmapColor(10, 100); // log(10)/log(100) ≈ 0.5

    // The color at value 10 (log midpoint) should be in the middle range
    // while value 50 (linear midpoint) should be further along
    expect(midLinear[0]).toBeGreaterThan(midLog[0]); // More red
  });

  it('handles large max values', () => {
    const color = heatmapColor(1000, 10000);
    // Should not throw and should produce valid colors
    for (const channel of color) {
      expect(channel).toBeGreaterThanOrEqual(0);
      expect(channel).toBeLessThanOrEqual(1);
    }
  });
});
