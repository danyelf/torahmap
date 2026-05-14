// src/utils/color.ts
import type { Color } from '../overlays/types.ts';
import { currentTheme } from '../themes.ts';

// Shared color constants
export const HIGHLIGHT_COLOR: Color = [0.2, 0.9, 1.0]; // Bright cyan for search/selection
export const DIM_FACTOR = 0.3; // Dimming factor for non-highlighted verses

// Search hue palette. Sourced from currentTheme.searchHues — see src/themes.ts
// for the rationale on hue choices and luminance separation per theme.
export const SEARCH_COLORS: Color[] = currentTheme.searchHues;

/**
 * A color stop in a gradient (position + color)
 */
export interface ColorStop {
  t: number;     // Position in [0, 1]
  color: Color;  // RGB color at this position
}

/**
 * Interpolate between color stops in a gradient
 * @param t Normalized position [0, 1]
 * @param stops Array of color stops (must be sorted by t, at least 2 stops)
 * @returns Interpolated color at position t
 */
export function interpolateGradient(t: number, stops: ColorStop[]): Color {
  // Clamp t to [0, 1]
  const clamped = Math.max(0, Math.min(1, t));

  // Find the two stops to interpolate between
  for (let i = 0; i < stops.length - 1; i++) {
    const stop1 = stops[i];
    const stop2 = stops[i + 1];

    if (clamped >= stop1.t && clamped <= stop2.t) {
      // Calculate local position within this segment [0, 1]
      const segmentLength = stop2.t - stop1.t;
      const localT = segmentLength > 0 ? (clamped - stop1.t) / segmentLength : 0;

      // Linear interpolation between the two colors
      return [
        stop1.color[0] + localT * (stop2.color[0] - stop1.color[0]),
        stop1.color[1] + localT * (stop2.color[1] - stop1.color[1]),
        stop1.color[2] + localT * (stop2.color[2] - stop1.color[2]),
      ];
    }
  }

  // If we get here, t is beyond the last stop (shouldn't happen with clamping)
  return stops[stops.length - 1].color;
}

/**
 * Map a value to a gradient using optional logarithmic scaling
 * @param value The input value
 * @param maxValue The maximum value (for normalization)
 * @param stops Array of color stops (must be sorted by t)
 * @param options Optional configuration (useLog for logarithmic scaling)
 * @returns Color from the gradient
 */
export function scaleToGradient(
  value: number,
  maxValue: number,
  stops: ColorStop[],
  options?: { useLog?: boolean }
): Color {
  const useLog = options?.useLog ?? false;

  if (useLog) {
    // Logarithmic scale: map 0..maxValue to 0..1
    const logMax = Math.log(maxValue + 1);
    const t = Math.log(value + 1) / logMax;
    return interpolateGradient(t, stops);
  } else {
    // Linear scale
    const t = maxValue > 0 ? value / maxValue : 0;
    return interpolateGradient(t, stops);
  }
}

/**
 * Heatmap color scale: dark blue -> light blue -> teal -> orange -> red
 * Uses logarithmic scale for better distribution
 */
export function heatmapColor(value: number, maxValue: number): Color {
  if (value === 0) return [0.15, 0.15, 0.2]; // Very dark for no data

  // Define gradient stops (5 colors across the range)
  const stops: ColorStop[] = [
    { t: 0, color: [0.1, 0.13, 0.18] },       // Dark blue
    { t: 0.25, color: [0.1, 0.23, 0.38] },    // Light blue
    { t: 0.5, color: [0.2, 0.43, 0.33] },     // Teal
    { t: 0.75, color: [0.9, 0.33, 0.13] },    // Orange
    { t: 1.0, color: [1.0, 0.23, 0.18] },     // Red
  ];

  return scaleToGradient(value, maxValue, stops, { useLog: true });
}

interface HSL {
  h: number; // 0-360
  s: number; // 0-1
  l: number; // 0-1
}

export function rgbToHsl(color: Color): HSL {
  const [r, g, b] = color;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  if (max === r) {
    h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  } else if (max === g) {
    h = ((b - r) / d + 2) / 6;
  } else {
    h = ((r - g) / d + 4) / 6;
  }

  return { h: h * 360, s, l };
}

export function hslToRgb(hsl: HSL): Color {
  const { h, s, l } = hsl;

  if (s === 0) {
    return [l, l, l];
  }

  const hueToRgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = h / 360;

  return [
    hueToRgb(p, q, hNorm + 1/3),
    hueToRgb(p, q, hNorm),
    hueToRgb(p, q, hNorm - 1/3),
  ];
}

/**
 * Circular mean for hue values (handles wraparound correctly)
 */
function circularMeanHue(hues: number[]): number {
  let sinSum = 0;
  let cosSum = 0;
  for (const h of hues) {
    const rad = (h * Math.PI) / 180;
    sinSum += Math.sin(rad);
    cosSum += Math.cos(rad);
  }
  const avgRad = Math.atan2(sinSum / hues.length, cosSum / hues.length);
  let avgDeg = (avgRad * 180) / Math.PI;
  if (avgDeg < 0) avgDeg += 360;
  return avgDeg;
}

/**
 * Blend multiple colors using HSL averaging (circular mean for hue)
 */
export function blendColorsHSL(colors: Color[]): Color {
  if (colors.length === 0) return [0, 0, 0];
  if (colors.length === 1) return colors[0];

  const hslColors = colors.map(rgbToHsl);

  const avgHue = circularMeanHue(hslColors.map(c => c.h));
  const avgSat = hslColors.reduce((sum, c) => sum + c.s, 0) / hslColors.length;
  const avgLight = hslColors.reduce((sum, c) => sum + c.l, 0) / hslColors.length;

  return hslToRgb({ h: avgHue, s: avgSat, l: avgLight });
}
