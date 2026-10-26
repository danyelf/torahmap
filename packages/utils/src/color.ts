/** Red, green and blue, each 0 to 1. */
export type Color = [number, number, number];

/** A color as CSS, for a swatch or a background the GPU is not drawing. */
export function colorToCss(color: Color): string {
  return `rgb(${Math.round(color[0] * 255)}, ${Math.round(color[1] * 255)}, ${Math.round(color[2] * 255)})`;
}

/** Each channel times `factor`, held at 1; a factor below 1 darkens. */
export function brighten(color: Color, factor: number): Color {
  return [
    Math.min(1, color[0] * factor),
    Math.min(1, color[1] * factor),
    Math.min(1, color[2] * factor),
  ];
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

/**
 * A color given in OKLCH: lightness 0 to 1, chroma (about 0 to 0.4) and hue in
 * degrees. Equal steps in lightness and chroma look equally far apart, which
 * RGB and HSL steps do not. The result is not clamped, so a color outside the
 * screen's range has a channel below 0 or above 1.
 */
export function oklchToRgb(lightness: number, chroma: number, hue: number): Color {
  const a = chroma * Math.cos((hue * Math.PI) / 180);
  const b = chroma * Math.sin((hue * Math.PI) / 180);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const encode = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  return [
    encode(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    encode(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    encode(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}
