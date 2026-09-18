import { describe, it, expect } from 'vitest';
import { summaryHtml } from '../../panelSummary';

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
  it('says so when there is no overlay', () => {
    expect(text(summaryHtml(undefined, {}))).toBe('No overlay');
  });

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

  it('draws a gradient as a strip rather than a square', () => {
    const html = summaryHtml('Commentary', { colors: ['linear-gradient(red, blue)', 'red'] });
    expect(swatches(html).map((el) => el.classList.contains('strip'))).toEqual([true, false]);
  });

  it('keeps the line short when there are many colours', () => {
    const many = Array.from({ length: 10 }, (_, i) => `rgb(${i}, 0, 0)`);
    expect(swatches(summaryHtml('Text Dating', { colors: many }))).toHaveLength(6);
  });

  it('escapes what it shows', () => {
    const html = summaryHtml('<b>', { terms: [{ text: '<i>', color: 'red' }], detail: '<u>' });
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');
    expect(html).not.toContain('<u>');
  });
});
