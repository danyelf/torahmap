import { describe, it, expect } from 'vitest';
import { summaryHtml } from '../src/panelSummary.ts';

function parse(html: string): HTMLDivElement {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

const text = (html: string): string => parse(html).textContent ?? '';

const swatches = (html: string): HTMLElement[] => [
  ...parse(html).querySelectorAll<HTMLElement>('.summary-swatch'),
];

describe('summaryHtml', () => {
  it('shows each term in its own colour', () => {
    const html = summaryHtml('Text Search', {
      terms: [
        { text: 'אברם', color: 'rgb(0, 170, 200)' },
        { text: 'אברהם', color: 'rgb(240, 130, 40)' },
      ],
    });
    expect(text(html)).toBe('Text Search·אברםאברהם');
    expect(swatches(html).map((el) => el.style.background)).toEqual([
      'rgb(0, 170, 200)',
      'rgb(240, 130, 40)',
    ]);
  });

  it('shows a detail and colours after the name', () => {
    const html = summaryHtml('Commentary', { detail: 'midrash', colors: ['red', 'blue'] });
    expect(text(html)).toBe('Commentary·midrash');
    expect(swatches(html).map((el) => el.style.background)).toEqual(['red', 'blue']);
  });

  it('shows the name alone when the overlay has nothing to add', () => {
    expect(text(summaryHtml('Haftarah', {}))).toBe('Haftarah');
  });

  it('draws a strip between its low and high ends', () => {
    const html = summaryHtml('Verse Length', {
      strip: { gradient: 'linear-gradient(red, blue)', ends: ['low', 'high'] },
    });
    const order = [...parse(html).querySelectorAll('.summary-end, .summary-swatch')].map((el) =>
      el.classList.contains('strip') ? 'strip' : el.textContent,
    );
    expect(order).toEqual(['low', 'strip', 'high']);
  });

  it('draws colours as squares, with no ends', () => {
    const html = summaryHtml('Trop', { colors: ['red', 'blue'] });
    expect(swatches(html).some((el) => el.classList.contains('strip'))).toBe(false);
    expect(parse(html).querySelector('.summary-end')).toBeNull();
  });

  it('keeps the line short when there are many colours', () => {
    const many = Array.from({ length: 10 }, (_, i) => `rgb(${i}, 0, 0)`);
    expect(swatches(summaryHtml('Text Dating', { colors: many }))).toHaveLength(6);
  });

  it('escapes what it shows', () => {
    const html = summaryHtml('<b>', {
      terms: [{ text: '<i>', color: 'red' }],
      detail: '<u>',
      strip: { gradient: 'red', ends: ['<s>', '<q>'] },
    });
    expect(html).not.toContain('<s>');
    expect(html).not.toContain('<q>');
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');
    expect(html).not.toContain('<u>');
  });
});
