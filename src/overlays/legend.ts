// Small pieces of legend markup for overlays that build their own HTML.

import type { Scale } from '../utils/scale.ts';
import type { Color } from './types.ts';
import { colorToCss, interpolateGradient } from '../utils/color.ts';
import './legend.css';

/** Samples across the strip: enough to read as continuous, few enough to stay short. */
const GRADIENT_SAMPLES = 10;

/**
 * How close two labels may sit before the earlier one is dropped, as a fraction
 * of the strip. Commentary's Halakhah category puts 100 and 113 within 2.6% of
 * each other — about nine pixels in a 340-pixel legend, with labels twice that
 * wide, so the pair renders as "1003".
 */
const MIN_LABEL_GAP = 0.1;

/** The gradient strip and tick labels for a continuous scale. */
export function renderAxis(
  scale: Scale,
  ticks: number[],
  format: (value: number) => string = (value) => value.toLocaleString(),
): string {
  const kept = spaceOut(ticks.map((value) => ({ value, at: scale.positionOf(value) })));

  const labels = kept
    .map(({ value, at }) => {
      const edge = at <= 0 ? ' tick-start' : at >= 1 ? ' tick-end' : '';
      return `<span class="tick${edge}" style="left: ${at * 100}%">${format(value)}</span>`;
    })
    .join('');

  return `
      <div class="legend-gradient" style="background: ${axisGradient(scale)}"></div>
      <div class="legend-ticks">${labels}</div>
    `;
}

/** `renderAxis` with zero as a swatch of its own, for a scale where none is unlike one. */
export function renderAxisWithZero(zero: Color, scale: Scale, ticks: number[]): string {
  return `
      <div class="legend-with-zero">
        <div class="legend-zero">
          <span class="legend-zero-swatch" style="background: ${colorToCss(zero)}"></span>
          <span class="legend-zero-label">0</span>
        </div>
        <div class="legend-axis">${renderAxis(scale, ticks)}</div>
      </div>
    `;
}

/** `colorAt` sampled at `samples` evenly spaced indices, as a left-to-right CSS gradient. */
export function buildLegendGradient(samples: number, colorAt: (index: number) => Color): string {
  const parts: string[] = [];
  for (let i = 0; i < samples; i++) {
    parts.push(`${colorToCss(colorAt(i))} ${(i / (samples - 1)) * 100}%`);
  }
  return `linear-gradient(to right, ${parts.join(', ')})`;
}

/** A continuous scale's colours as a CSS gradient. */
export function axisGradient(scale: Scale): string {
  return buildLegendGradient(GRADIENT_SAMPLES, (i) =>
    interpolateGradient(i / (GRADIENT_SAMPLES - 1), scale.palette),
  );
}

interface PlacedTick {
  value: number;
  at: number;
}

/** Of two labels too close to read apart, the later one is the one worth keeping. */
function spaceOut(ticks: PlacedTick[]): PlacedTick[] {
  const kept: PlacedTick[] = [];

  for (let i = ticks.length - 1; i >= 0; i--) {
    const next = kept[kept.length - 1];
    if (!next || next.at - ticks[i].at >= MIN_LABEL_GAP) kept.push(ticks[i]);
  }

  return kept.reverse();
}

/** A `.legend-row`: a colour swatch and its label, with `labelClass` on the label if given. */
export function legendRow(swatchBackground: string, label: string, labelClass?: string): string {
  const labelAttr = labelClass ? ` class="${labelClass}"` : '';
  return `<div class="legend-row"><span class="swatch" style="background: ${swatchBackground}"></span><span${labelAttr}>${label}</span></div>`;
}

/** A line of small grey text under a legend. */
export function legendCaption(text: string): string {
  return `<div class="legend-caption">${text}</div>`;
}
