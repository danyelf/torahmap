// src/utils/color.ts
import type { Color } from '../overlays/types.ts';

// Shared color constants
export const HIGHLIGHT_COLOR: Color = [0.2, 0.9, 1.0]; // Bright cyan for search/selection
export const DIM_FACTOR = 0.3; // Dimming factor for non-highlighted verses

// Fixed palette for multi-term search (cyan, orange, lime, pink, yellow)
export const SEARCH_COLORS: Color[] = [
  [0.2, 0.9, 1.0],   // Cyan
  [1.0, 0.5, 0.0],   // Orange
  [0.5, 1.0, 0.2],   // Lime
  [1.0, 0.2, 0.8],   // Pink
  [1.0, 1.0, 0.2],   // Yellow
];

/**
 * Heatmap color scale: dark blue -> light blue -> teal -> orange -> red
 * Uses logarithmic scale for better distribution
 */
export function heatmapColor(value: number, maxValue: number): Color {
  if (value === 0) return [0.15, 0.15, 0.2]; // Very dark for no data

  // Log scale: map 1..maxValue to 0..1
  const logMax = Math.log(maxValue + 1);
  const t = Math.log(value + 1) / logMax;

  // Multi-stop gradient
  if (t < 0.25) {
    const s = t / 0.25;
    return [0.1, 0.13 + s * 0.1, 0.18 + s * 0.2];
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25;
    return [0.1 + s * 0.1, 0.23 + s * 0.2, 0.38 - s * 0.05];
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25;
    return [0.2 + s * 0.7, 0.43 - s * 0.1, 0.33 - s * 0.2];
  } else {
    const s = (t - 0.75) / 0.25;
    return [0.9 + s * 0.1, 0.33 - s * 0.1, 0.13 + s * 0.05];
  }
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
