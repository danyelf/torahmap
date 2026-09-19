// Small pieces of legend markup shared by overlays that build their own HTML.

import type { Scale } from '../utils/scale.ts';
import { buildLegendGradient, interpolateGradient } from '../utils/color.ts';
import '../styles/legend-axis.css';

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
    .map(({ value, at }, i) => {
      const edge = i === 0 ? ' tick-start' : i === kept.length - 1 ? ' tick-end' : '';
      return `<span class="tick${edge}" style="left: ${at * 100}%">${format(value)}</span>`;
    })
    .join('');

  return `
      <div class="legend-gradient" style="background: ${axisGradient(scale)}"></div>
      <div class="legend-ticks">${labels}</div>
    `;
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

/**
 * A `.legend-row` holding a color swatch and a label, as trop and text-dating
 * both build it. `labelClass`, when given, is set on the label span (text-dating
 * uses `label` for its line-height).
 */
export function legendRow(swatchBackground: string, label: string, labelClass?: string): string {
  const labelAttr = labelClass ? ` class="${labelClass}"` : '';
  return `<div class="legend-row"><span class="swatch" style="background: ${swatchBackground}"></span><span${labelAttr}>${label}</span></div>`;
}

/** A grey 10px caption line under a legend, as haftarah and verse-length both build it. */
export function legendCaption(
  text: string,
  options?: { marginTop?: number; marginLeft?: number; color?: string; lineHeight?: number },
): string {
  const marginTop = options?.marginTop ?? 4;
  const color = options?.color ?? '#888';
  const lineHeight = options?.lineHeight ?? 1.3;
  const marginLeft =
    options?.marginLeft !== undefined ? ` margin-left: ${options.marginLeft}px;` : '';
  return `<div style="color: ${color}; font-size: 10px; margin-top: ${marginTop}px;${marginLeft} line-height: ${lineHeight};">${text}</div>`;
}
