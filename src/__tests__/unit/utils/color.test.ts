// Tests for src/utils/color.ts
import { describe, it, expect } from 'vitest';
import {
  heatmapColor,
  rgbToHsl,
  hslToRgb,
  blendColorsHSL,
  interpolateGradient,
  scaleToGradient,
  HIGHLIGHT_COLOR,
  DIM_FACTOR,
  SEARCH_COLORS,
  type ColorStop,
} from '../../../utils/color';
import { assertValidColor, assertColorEquals } from '../../helpers/assertions';
import { TEST_COLORS } from '../../helpers/fixtures';
import type { Color } from '../../../overlays/types';

describe('interpolateGradient', () => {
  const simpleGradient: ColorStop[] = [
    { t: 0, color: [0, 0, 0] },      // Black
    { t: 1, color: [1, 1, 1] },      // White
  ];

  const multiStopGradient: ColorStop[] = [
    { t: 0, color: [1, 0, 0] },      // Red
    { t: 0.5, color: [0, 1, 0] },    // Green
    { t: 1, color: [0, 0, 1] },      // Blue
  ];

  it('returns first color at t=0', () => {
    const color = interpolateGradient(0, simpleGradient);
    assertColorEquals(color, [0, 0, 0], 0.01);
  });

  it('returns last color at t=1', () => {
    const color = interpolateGradient(1, simpleGradient);
    assertColorEquals(color, [1, 1, 1], 0.01);
  });

  it('returns midpoint color at t=0.5', () => {
    const color = interpolateGradient(0.5, simpleGradient);
    assertColorEquals(color, [0.5, 0.5, 0.5], 0.01);
  });

  it('interpolates correctly in first segment', () => {
    const color = interpolateGradient(0.25, multiStopGradient);
    assertValidColor(color);
    // Should be halfway between red and green
    expect(color[0]).toBeCloseTo(0.5, 2);
    expect(color[1]).toBeCloseTo(0.5, 2);
    expect(color[2]).toBeCloseTo(0, 2);
  });

  it('interpolates correctly in second segment', () => {
    const color = interpolateGradient(0.75, multiStopGradient);
    assertValidColor(color);
    // Should be halfway between green and blue
    expect(color[0]).toBeCloseTo(0, 2);
    expect(color[1]).toBeCloseTo(0.5, 2);
    expect(color[2]).toBeCloseTo(0.5, 2);
  });

  it('clamps values below 0', () => {
    const color = interpolateGradient(-0.5, simpleGradient);
    assertColorEquals(color, [0, 0, 0], 0.01);
  });

  it('clamps values above 1', () => {
    const color = interpolateGradient(1.5, simpleGradient);
    assertColorEquals(color, [1, 1, 1], 0.01);
  });

  it('handles gradient with many stops', () => {
    const gradient: ColorStop[] = [
      { t: 0, color: [0, 0, 0] },
      { t: 0.25, color: [0.25, 0.25, 0.25] },
      { t: 0.5, color: [0.5, 0.5, 0.5] },
      { t: 0.75, color: [0.75, 0.75, 0.75] },
      { t: 1, color: [1, 1, 1] },
    ];

    for (let t = 0; t <= 1; t += 0.1) {
      const color = interpolateGradient(t, gradient);
      assertValidColor(color);
    }
  });

  it('returns exact color at stop positions', () => {
    for (const stop of multiStopGradient) {
      const color = interpolateGradient(stop.t, multiStopGradient);
      assertColorEquals(color, stop.color, 0.01);
    }
  });

  it('produces smooth transitions', () => {
    const colors: Color[] = [];
    for (let t = 0; t <= 1; t += 0.1) {
      colors.push(interpolateGradient(t, simpleGradient));
    }

    // Check that adjacent colors are not too different (smooth gradient)
    for (let i = 1; i < colors.length; i++) {
      const distance = Math.sqrt(
        Math.pow(colors[i][0] - colors[i - 1][0], 2) +
        Math.pow(colors[i][1] - colors[i - 1][1], 2) +
        Math.pow(colors[i][2] - colors[i - 1][2], 2)
      );
      expect(distance).toBeLessThan(0.3);
    }
  });

  it('handles stops with zero segment length', () => {
    // Edge case: two stops at same position (shouldn't happen in practice)
    const gradient: ColorStop[] = [
      { t: 0, color: [0, 0, 0] },
      { t: 0.5, color: [0.5, 0.5, 0.5] },
      { t: 0.5, color: [0.6, 0.6, 0.6] },
      { t: 1, color: [1, 1, 1] },
    ];

    const color = interpolateGradient(0.5, gradient);
    assertValidColor(color);
  });
});

describe('scaleToGradient', () => {
  const gradient: ColorStop[] = [
    { t: 0, color: [0, 0, 0] },
    { t: 1, color: [1, 1, 1] },
  ];

  describe('linear scaling', () => {
    it('maps 0 to first color', () => {
      const color = scaleToGradient(0, 100, gradient);
      assertColorEquals(color, [0, 0, 0], 0.01);
    });

    it('maps maxValue to last color', () => {
      const color = scaleToGradient(100, 100, gradient);
      assertColorEquals(color, [1, 1, 1], 0.01);
    });

    it('maps midpoint to middle color', () => {
      const color = scaleToGradient(50, 100, gradient);
      assertColorEquals(color, [0.5, 0.5, 0.5], 0.01);
    });

    it('handles maxValue of 0', () => {
      const color = scaleToGradient(0, 0, gradient);
      assertColorEquals(color, [0, 0, 0], 0.01);
    });

    it('produces linear progression', () => {
      const max = 100;
      const colors: Color[] = [];
      for (let v = 0; v <= max; v += 10) {
        colors.push(scaleToGradient(v, max, gradient));
      }

      // Check equal spacing in color space
      for (let i = 2; i < colors.length; i++) {
        const diff1 = colors[i - 1][0] - colors[i - 2][0];
        const diff2 = colors[i][0] - colors[i - 1][0];
        expect(diff1).toBeCloseTo(diff2, 2);
      }
    });
  });

  describe('logarithmic scaling', () => {
    it('maps 0 to first color', () => {
      const color = scaleToGradient(0, 100, gradient, { useLog: true });
      assertColorEquals(color, [0, 0, 0], 0.01);
    });

    it('maps maxValue to last color', () => {
      const color = scaleToGradient(100, 100, gradient, { useLog: true });
      assertColorEquals(color, [1, 1, 1], 0.01);
    });

    it('produces non-linear progression', () => {
      const max = 100;
      const color1 = scaleToGradient(1, max, gradient, { useLog: true });
      const color10 = scaleToGradient(10, max, gradient, { useLog: true });
      const color91 = scaleToGradient(91, max, gradient, { useLog: true });
      const color100 = scaleToGradient(100, max, gradient, { useLog: true });

      // Difference between 1 and 10 should be greater than between 91 and 100
      const diff1to10 = Math.abs(color10[0] - color1[0]);
      const diff91to100 = Math.abs(color100[0] - color91[0]);

      expect(diff1to10).toBeGreaterThan(diff91to100);
    });

    it('handles small values correctly', () => {
      const color = scaleToGradient(1, 1000, gradient, { useLog: true });
      assertValidColor(color);
      // Should be closer to the start than with linear scale
      const linearColor = scaleToGradient(1, 1000, gradient);
      expect(color[0]).toBeGreaterThan(linearColor[0]);
    });
  });

  it('works with multi-stop gradients', () => {
    const multiStop: ColorStop[] = [
      { t: 0, color: [1, 0, 0] },
      { t: 0.5, color: [0, 1, 0] },
      { t: 1, color: [0, 0, 1] },
    ];

    for (let v = 0; v <= 100; v += 10) {
      const color = scaleToGradient(v, 100, multiStop);
      assertValidColor(color);
    }
  });

  it('produces valid colors for all inputs', () => {
    const max = 1000;
    for (let v = 0; v <= max; v += 50) {
      const linearColor = scaleToGradient(v, max, gradient);
      const logColor = scaleToGradient(v, max, gradient, { useLog: true });
      assertValidColor(linearColor);
      assertValidColor(logColor);
    }
  });
});

describe('heatmapColor', () => {
  it('returns very dark color for zero value', () => {
    const color = heatmapColor(0, 100);
    expect(color).toEqual([0.15, 0.15, 0.2]);
  });

  it('returns valid colors for all inputs', () => {
    const maxValue = 1000;
    for (let i = 0; i <= maxValue; i += 10) {
      const color = heatmapColor(i, maxValue);
      assertValidColor(color);
    }
  });

  it('returns darker colors for smaller values', () => {
    const max = 100;
    const color1 = heatmapColor(1, max);
    const color10 = heatmapColor(10, max);
    const color50 = heatmapColor(50, max);
    const color100 = heatmapColor(100, max);

    // Colors should generally get brighter (higher channel values) as value increases
    const brightness = (c: Color) => c[0] + c[1] + c[2];
    expect(brightness(color1)).toBeLessThan(brightness(color10));
    expect(brightness(color10)).toBeLessThan(brightness(color50));
    expect(brightness(color50)).toBeLessThan(brightness(color100));
  });

  it('uses logarithmic scale', () => {
    // With log scale, the difference between 1 and 10 should be greater than
    // the difference between 91 and 100
    const max = 100;
    const color1 = heatmapColor(1, max);
    const color10 = heatmapColor(10, max);
    const color91 = heatmapColor(91, max);
    const color100 = heatmapColor(100, max);

    const diff1to10 = Math.abs(color10[0] - color1[0]);
    const diff91to100 = Math.abs(color100[0] - color91[0]);

    expect(diff1to10).toBeGreaterThan(diff91to100);
  });

  it('handles maxValue of 1', () => {
    const color = heatmapColor(1, 1);
    assertValidColor(color);
  });

  it('handles large maxValue', () => {
    const color = heatmapColor(5000, 10000);
    assertValidColor(color);
  });

  it('returns same color for same ratio', () => {
    // Same relative position should give similar colors
    const color1 = heatmapColor(50, 100);
    const color2 = heatmapColor(500, 1000);

    assertColorEquals(color1, color2, 0.03);
  });

  it('progresses through gradient stops', () => {
    // Test that we get different colors in different gradient ranges
    const max = 1000;
    const color25pct = heatmapColor(Math.floor(max * 0.25), max); // First stop
    const color50pct = heatmapColor(Math.floor(max * 0.5), max);  // Second stop
    const color75pct = heatmapColor(Math.floor(max * 0.75), max); // Third stop
    const color100pct = heatmapColor(max, max);                   // Fourth stop

    // All should be different
    expect(color25pct).not.toEqual(color50pct);
    expect(color50pct).not.toEqual(color75pct);
    expect(color75pct).not.toEqual(color100pct);
  });

  it('handles edge case where value equals maxValue', () => {
    const color = heatmapColor(100, 100);
    assertValidColor(color);
    // Should be at the brightest end of the scale
    expect(color[0]).toBeGreaterThan(0.8);
  });

  it('produces distinct colors across the range', () => {
    const max = 100;
    const colors = [];
    for (let i = 1; i <= max; i += 10) {
      colors.push(heatmapColor(i, max));
    }

    // Each color should be sufficiently different from its neighbors
    for (let i = 1; i < colors.length; i++) {
      const prev = colors[i - 1];
      const curr = colors[i];
      const distance = Math.sqrt(
        Math.pow(curr[0] - prev[0], 2) +
        Math.pow(curr[1] - prev[1], 2) +
        Math.pow(curr[2] - prev[2], 2)
      );
      expect(distance).toBeGreaterThan(0.01); // Colors should be visibly different
    }
  });
});

describe('rgbToHsl', () => {
  it('converts pure red correctly', () => {
    const hsl = rgbToHsl(TEST_COLORS.RED);
    expect(hsl.h).toBeCloseTo(0, 1);
    expect(hsl.s).toBeCloseTo(1, 2);
    expect(hsl.l).toBeCloseTo(0.5, 2);
  });

  it('converts pure green correctly', () => {
    const hsl = rgbToHsl(TEST_COLORS.GREEN);
    expect(hsl.h).toBeCloseTo(120, 1);
    expect(hsl.s).toBeCloseTo(1, 2);
    expect(hsl.l).toBeCloseTo(0.5, 2);
  });

  it('converts pure blue correctly', () => {
    const hsl = rgbToHsl(TEST_COLORS.BLUE);
    expect(hsl.h).toBeCloseTo(240, 1);
    expect(hsl.s).toBeCloseTo(1, 2);
    expect(hsl.l).toBeCloseTo(0.5, 2);
  });

  it('converts white correctly', () => {
    const hsl = rgbToHsl(TEST_COLORS.WHITE);
    expect(hsl.h).toBe(0); // Hue is undefined for achromatic, but implementation returns 0
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBeCloseTo(1, 2);
  });

  it('converts black correctly', () => {
    const hsl = rgbToHsl(TEST_COLORS.BLACK);
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBe(0);
  });

  it('converts gray correctly', () => {
    const hsl = rgbToHsl(TEST_COLORS.GRAY);
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBeCloseTo(0.5, 2);
  });

  it('converts yellow correctly', () => {
    const hsl = rgbToHsl(TEST_COLORS.YELLOW);
    expect(hsl.h).toBeCloseTo(60, 1);
    expect(hsl.s).toBeCloseTo(1, 2);
    expect(hsl.l).toBeCloseTo(0.5, 2);
  });

  it('returns hue in 0-360 range', () => {
    const colors: Color[] = [
      [1, 0, 0],    // Red
      [0, 1, 0],    // Green
      [0, 0, 1],    // Blue
      [1, 1, 0],    // Yellow
      [1, 0, 1],    // Magenta
      [0, 1, 1],    // Cyan
    ];

    for (const color of colors) {
      const hsl = rgbToHsl(color);
      expect(hsl.h).toBeGreaterThanOrEqual(0);
      expect(hsl.h).toBeLessThan(360);
    }
  });

  it('returns saturation in 0-1 range', () => {
    const colors: Color[] = [
      [1, 0, 0],
      [0.5, 0.5, 0.5],
      [0.8, 0.2, 0.5],
      [0.1, 0.9, 0.3],
    ];

    for (const color of colors) {
      const hsl = rgbToHsl(color);
      expect(hsl.s).toBeGreaterThanOrEqual(0);
      expect(hsl.s).toBeLessThanOrEqual(1);
    }
  });

  it('returns lightness in 0-1 range', () => {
    const colors: Color[] = [
      [0, 0, 0],
      [1, 1, 1],
      [0.5, 0.5, 0.5],
      [0.8, 0.2, 0.5],
    ];

    for (const color of colors) {
      const hsl = rgbToHsl(color);
      expect(hsl.l).toBeGreaterThanOrEqual(0);
      expect(hsl.l).toBeLessThanOrEqual(1);
    }
  });

  it('handles colors with different max channels', () => {
    // Test the three branches of hue calculation
    const colorMaxR: Color = [0.8, 0.2, 0.1]; // Red is max
    const colorMaxG: Color = [0.2, 0.8, 0.1]; // Green is max
    const colorMaxB: Color = [0.2, 0.1, 0.8]; // Blue is max

    const hslR = rgbToHsl(colorMaxR);
    const hslG = rgbToHsl(colorMaxG);
    const hslB = rgbToHsl(colorMaxB);

    // Red should have hue near 0
    expect(hslR.h).toBeLessThan(60);
    // Green should have hue near 120
    expect(hslG.h).toBeGreaterThan(90);
    expect(hslG.h).toBeLessThan(150);
    // Blue should have hue near 240
    expect(hslB.h).toBeGreaterThan(210);
    expect(hslB.h).toBeLessThan(270);
  });
});

describe('hslToRgb', () => {
  it('converts pure red HSL to RGB correctly', () => {
    const rgb = hslToRgb({ h: 0, s: 1, l: 0.5 });
    assertColorEquals(rgb, TEST_COLORS.RED, 0.01);
  });

  it('converts pure green HSL to RGB correctly', () => {
    const rgb = hslToRgb({ h: 120, s: 1, l: 0.5 });
    assertColorEquals(rgb, TEST_COLORS.GREEN, 0.01);
  });

  it('converts pure blue HSL to RGB correctly', () => {
    const rgb = hslToRgb({ h: 240, s: 1, l: 0.5 });
    assertColorEquals(rgb, TEST_COLORS.BLUE, 0.01);
  });

  it('converts white HSL to RGB correctly', () => {
    const rgb = hslToRgb({ h: 0, s: 0, l: 1 });
    assertColorEquals(rgb, TEST_COLORS.WHITE, 0.01);
  });

  it('converts black HSL to RGB correctly', () => {
    const rgb = hslToRgb({ h: 0, s: 0, l: 0 });
    assertColorEquals(rgb, TEST_COLORS.BLACK, 0.01);
  });

  it('converts gray HSL to RGB correctly', () => {
    const rgb = hslToRgb({ h: 0, s: 0, l: 0.5 });
    assertColorEquals(rgb, TEST_COLORS.GRAY, 0.01);
  });

  it('returns grayscale for zero saturation', () => {
    const rgb1 = hslToRgb({ h: 0, s: 0, l: 0.3 });
    const rgb2 = hslToRgb({ h: 180, s: 0, l: 0.7 });

    expect(rgb1[0]).toBeCloseTo(rgb1[1], 5);
    expect(rgb1[1]).toBeCloseTo(rgb1[2], 5);
    expect(rgb2[0]).toBeCloseTo(rgb2[1], 5);
    expect(rgb2[1]).toBeCloseTo(rgb2[2], 5);
  });

  it('handles all hue ranges correctly', () => {
    // Test each sixth of the hue circle
    for (let h = 0; h < 360; h += 60) {
      const rgb = hslToRgb({ h, s: 1, l: 0.5 });
      assertValidColor(rgb);
    }
  });

  it('handles lightness extremes', () => {
    const black = hslToRgb({ h: 180, s: 1, l: 0 });
    const white = hslToRgb({ h: 180, s: 1, l: 1 });

    assertColorEquals(black, TEST_COLORS.BLACK, 0.01);
    assertColorEquals(white, TEST_COLORS.WHITE, 0.01);
  });

  it('produces valid RGB values for all valid HSL inputs', () => {
    for (let h = 0; h < 360; h += 30) {
      for (let s = 0; s <= 1; s += 0.25) {
        for (let l = 0; l <= 1; l += 0.25) {
          const rgb = hslToRgb({ h, s, l });
          assertValidColor(rgb);
        }
      }
    }
  });

  it('is inverse of rgbToHsl for saturated colors', () => {
    const originalColors: Color[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, 0],
      [1, 0, 1],
      [0, 1, 1],
    ];

    for (const original of originalColors) {
      const hsl = rgbToHsl(original);
      const rgb = hslToRgb(hsl);
      assertColorEquals(rgb, original, 0.01);
    }
  });
});

describe('rgbToHsl and hslToRgb roundtrip', () => {
  it('converts back and forth without loss', () => {
    const colors: Color[] = [
      [0.8, 0.3, 0.5],
      [0.2, 0.9, 0.1],
      [0.1, 0.2, 0.8],
      [0.6, 0.6, 0.2],
      [0.9, 0.1, 0.7],
    ];

    for (const original of colors) {
      const hsl = rgbToHsl(original);
      const rgb = hslToRgb(hsl);
      assertColorEquals(rgb, original, 0.01);
    }
  });

  it('roundtrips correctly for grayscale colors', () => {
    const grays: Color[] = [
      [0, 0, 0],
      [0.25, 0.25, 0.25],
      [0.5, 0.5, 0.5],
      [0.75, 0.75, 0.75],
      [1, 1, 1],
    ];

    for (const gray of grays) {
      const hsl = rgbToHsl(gray);
      const rgb = hslToRgb(hsl);
      assertColorEquals(rgb, gray, 0.01);
    }
  });
});

describe('blendColorsHSL', () => {
  it('returns black for empty array', () => {
    const result = blendColorsHSL([]);
    expect(result).toEqual([0, 0, 0]);
  });

  it('returns the same color for single color array', () => {
    const color: Color = [0.8, 0.3, 0.5];
    const result = blendColorsHSL([color]);
    expect(result).toEqual(color);
  });

  it('blends two colors', () => {
    const color1: Color = [1, 0, 0]; // Red
    const color2: Color = [0, 1, 0]; // Green
    const result = blendColorsHSL([color1, color2]);

    assertValidColor(result);
    // Result should be yellowish (between red and green)
    expect(result[0]).toBeGreaterThan(0.3);
    expect(result[1]).toBeGreaterThan(0.3);
    expect(result[2]).toBeLessThan(0.3);
  });

  it('blends multiple colors', () => {
    const colors: Color[] = [
      [1, 0, 0], // Red
      [0, 1, 0], // Green
      [0, 0, 1], // Blue
    ];
    const result = blendColorsHSL(colors);

    assertValidColor(result);
    // Blending RGB primaries should give a grayish result
  });

  it('blends similar colors to similar result', () => {
    const colors: Color[] = [
      [1, 0, 0],
      [0.9, 0.1, 0.1],
      [0.95, 0.05, 0.05],
    ];
    const result = blendColorsHSL(colors);

    assertValidColor(result);
    // Result should be reddish
    expect(result[0]).toBeGreaterThan(0.7);
  });

  it('handles grayscale colors', () => {
    const colors: Color[] = [
      [0.3, 0.3, 0.3],
      [0.5, 0.5, 0.5],
      [0.7, 0.7, 0.7],
    ];
    const result = blendColorsHSL(colors);

    assertValidColor(result);
    // Result should be gray (all channels similar)
    expect(Math.abs(result[0] - result[1])).toBeLessThan(0.1);
    expect(Math.abs(result[1] - result[2])).toBeLessThan(0.1);
  });

  it('uses circular mean for hue correctly', () => {
    // Red is at 0 degrees, and wraps around at 360
    // Blending red (0°) and red-violet (350°) should give red, not cyan (180°)
    const red: Color = [1, 0, 0]; // 0°
    const redViolet: Color = [1, 0, 0.5]; // ~330°
    const result = blendColorsHSL([red, redViolet]);

    const hsl = rgbToHsl(result);
    // Hue should be near 0° (or 360°), not near 180°
    expect(hsl.h < 30 || hsl.h > 330).toBe(true);
  });

  it('averages saturation linearly', () => {
    const color1: Color = [1, 0, 0]; // High saturation
    const color2: Color = [0.6, 0.4, 0.4]; // Lower saturation
    const result = blendColorsHSL([color1, color2]);

    const hsl1 = rgbToHsl(color1);
    const hsl2 = rgbToHsl(color2);
    const hslResult = rgbToHsl(result);

    const avgSat = (hsl1.s + hsl2.s) / 2;
    expect(hslResult.s).toBeCloseTo(avgSat, 2);
  });

  it('averages lightness linearly', () => {
    const color1: Color = [0.8, 0, 0]; // Lighter red
    const color2: Color = [0.2, 0, 0]; // Darker red
    const result = blendColorsHSL([color1, color2]);

    const hsl1 = rgbToHsl(color1);
    const hsl2 = rgbToHsl(color2);
    const hslResult = rgbToHsl(result);

    const avgLight = (hsl1.l + hsl2.l) / 2;
    expect(hslResult.l).toBeCloseTo(avgLight, 2);
  });

  it('produces valid colors for all inputs', () => {
    const testCases: Color[][] = [
      [[1, 0, 0], [0, 1, 0]],
      [[0, 0, 1], [1, 1, 0]],
      [[0.5, 0.5, 0.5], [0.8, 0.2, 0.3]],
      [[1, 1, 1], [0, 0, 0]],
      [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6], [0.7, 0.8, 0.9]],
    ];

    for (const colors of testCases) {
      const result = blendColorsHSL(colors);
      assertValidColor(result);
    }
  });

  it('handles many colors', () => {
    const colors: Color[] = SEARCH_COLORS.slice(); // Use the 5 search colors
    const result = blendColorsHSL(colors);

    assertValidColor(result);
  });

  it('is commutative for two colors', () => {
    const color1: Color = [0.8, 0.3, 0.2];
    const color2: Color = [0.2, 0.7, 0.9];

    const result1 = blendColorsHSL([color1, color2]);
    const result2 = blendColorsHSL([color2, color1]);

    assertColorEquals(result1, result2, 0.01);
  });
});
