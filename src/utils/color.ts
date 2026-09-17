import type { Color } from '../overlays/types.ts';

// Fixed palette for multi-term search (cyan, orange, lime, pink, yellow)
export const SEARCH_COLORS: Color[] = [
  [0.1, 0.7, 0.8], // Cyan (dimmed for luminance balance)
  [1.0, 0.5, 0.0], // Orange
  [0.5, 1.0, 0.2], // Lime
  [1.0, 0.2, 0.8], // Pink
  [1.0, 1.0, 0.2], // Yellow
];

/** A color as CSS, for a swatch or a background the GPU is not drawing. */
export function colorToCss(color: Color): string {
  return `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
}

/** A color stop in a gradient: position in [0, 1] and the color there. */
export interface ColorStop {
  t: number;
  color: Color;
}

/** Interpolate between color stops (must be sorted by t, at least 2 stops). */
export function interpolateGradient(t: number, stops: ColorStop[]): Color {
  const clamped = Math.max(0, Math.min(1, t));

  for (let i = 0; i < stops.length - 1; i++) {
    const stop1 = stops[i];
    const stop2 = stops[i + 1];

    if (clamped >= stop1.t && clamped <= stop2.t) {
      const segmentLength = stop2.t - stop1.t;
      const localT = segmentLength > 0 ? (clamped - stop1.t) / segmentLength : 0;

      return [
        stop1.color[0] + localT * (stop2.color[0] - stop1.color[0]),
        stop1.color[1] + localT * (stop2.color[1] - stop1.color[1]),
        stop1.color[2] + localT * (stop2.color[2] - stop1.color[2]),
      ];
    }
  }

  return stops[stops.length - 1].color;
}

/** Map a value onto a gradient, normalized linearly or (with useLog) logarithmically. */
export function scaleToGradient(
  value: number,
  maxValue: number,
  stops: ColorStop[],
  options?: { useLog?: boolean },
): Color {
  const useLog = options?.useLog ?? false;

  if (useLog) {
    const logMax = Math.log(maxValue + 1);
    const t = Math.log(value + 1) / logMax;
    return interpolateGradient(t, stops);
  } else {
    const t = maxValue > 0 ? value / maxValue : 0;
    return interpolateGradient(t, stops);
  }
}

/**
 * Renders a CSS `linear-gradient(...)` string by sampling `colorAt` at `stops`
 * evenly spaced indices (0..stops-1). Used to build legend gradient bars.
 */
export function buildLegendGradient(stops: number, colorAt: (index: number) => Color): string {
  const parts: string[] = [];
  for (let i = 0; i < stops; i++) {
    const rgb = colorAt(i)
      .map((c) => Math.round(c * 255))
      .join(', ');
    const percent = (i / (stops - 1)) * 100;
    parts.push(`rgb(${rgb}) ${percent}%`);
  }
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

/** Heatmap scale: dark blue -> light blue -> teal -> orange -> red, logarithmic. */
export function heatmapColor(value: number, maxValue: number): Color {
  if (value === 0) return [0.15, 0.15, 0.2]; // No data

  const stops: ColorStop[] = [
    { t: 0, color: [0.1, 0.13, 0.18] }, // Dark blue
    { t: 0.25, color: [0.1, 0.23, 0.38] }, // Light blue
    { t: 0.5, color: [0.2, 0.43, 0.33] }, // Teal
    { t: 0.75, color: [0.9, 0.33, 0.13] }, // Orange
    { t: 1.0, color: [1.0, 0.23, 0.18] }, // Red
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
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = h / 360;

  return [hueToRgb(p, q, hNorm + 1 / 3), hueToRgb(p, q, hNorm), hueToRgb(p, q, hNorm - 1 / 3)];
}
