import { describe, it, expect } from 'vitest';
import { renderAxis } from '../../../overlays/legend';
import { scale, LOG, SQRT } from '../../../utils/scale';
import type { ColorStop } from '../../../utils/color';

const BLACK_TO_WHITE: ColorStop[] = [
  { t: 0, color: [0, 0, 0] },
  { t: 1, color: [1, 1, 1] },
];

function draw(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
}

const labelsOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('.tick')).map((tick) => tick.textContent);

describe('renderAxis', () => {
  it('labels each tick at the position its value falls on', () => {
    const container = draw(renderAxis(scale(0, 1000, LOG, BLACK_TO_WHITE), [0, 9, 1000]));

    const ticks = Array.from(container.querySelectorAll<HTMLElement>('.tick'));
    expect(ticks.map((t) => t.textContent)).toEqual(['0', '9', '1,000']);
    expect(ticks[1].style.left).toMatch(/^33\.3/);
  });

  it('draws the strip from the palette the scale colours verses with', () => {
    const container = draw(renderAxis(scale(0, 100, LOG, BLACK_TO_WHITE), [0, 100]));

    const strip = container.querySelector<HTMLElement>('.legend-gradient');
    expect(strip?.style.background).toContain('rgb(0, 0, 0) 0%');
    expect(strip?.style.background).toContain('rgb(255, 255, 255) 100%');
  });

  it('aligns the outermost labels inwards so they stay on the strip', () => {
    const container = draw(renderAxis(scale(0, 1000, LOG, BLACK_TO_WHITE), [0, 9, 99, 1000]));

    const ticks = Array.from(container.querySelectorAll('.tick'));
    expect(ticks[0].className).toContain('tick-start');
    expect(ticks[ticks.length - 1].className).toContain('tick-end');
    for (const middle of ticks.slice(1, -1)) {
      expect(middle.className).toBe('tick');
    }
  });

  it('drops a label that would print on top of the one after it', () => {
    // 100 and 113 sit 2.6% apart on a log scale stopping at 113 — the Halakhah
    // category, where the pair rendered as "1003".
    const container = draw(renderAxis(scale(0, 113, LOG, BLACK_TO_WHITE), [0, 1, 10, 100, 113]));

    expect(labelsOf(container)).toEqual(['0', '1', '10', '113']);
  });

  it('keeps both labels when they are far enough apart', () => {
    const container = draw(renderAxis(scale(0, 900, LOG, BLACK_TO_WHITE), [0, 1, 10, 100, 900]));

    expect(labelsOf(container)).toEqual(['0', '1', '10', '100', '900']);
  });

  it('lets a caller give its numbers a unit', () => {
    const words = scale(2, 36, SQRT, BLACK_TO_WHITE);
    const container = draw(renderAxis(words, [2, 36], (n) => `${n} words`));

    expect(labelsOf(container)).toEqual(['2 words', '36 words']);
  });
});
