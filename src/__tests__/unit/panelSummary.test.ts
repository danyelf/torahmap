import { describe, it, expect } from 'vitest';
import { drawnColors, summaryHtml } from '../../panelSummary';

function text(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent ?? '';
}

function swatchColors(html: string): string[] {
  const div = document.createElement('div');
  div.innerHTML = html;
  return [...div.querySelectorAll<HTMLElement>('.summary-swatch')].map((el) => el.style.background);
}

describe('summaryHtml', () => {
  it('says so when there is no overlay', () => {
    expect(text(summaryHtml('none', undefined, {}, [], []))).toBe('No overlay');
  });

  it('shows each search term in its own colour', () => {
    const html = summaryHtml(
      'search',
      'Text Search',
      { q: 'אברם,אברהם', mode: 'x' },
      ['rgb(0, 170, 200)', 'rgb(240, 130, 40)'],
      [],
    );
    expect(text(html)).toBe('Text Search·אברםאברהם');
    expect(swatchColors(html)).toEqual(['rgb(0, 170, 200)', 'rgb(240, 130, 40)']);
  });

  it('shows other overlays by their settings and their legend colours', () => {
    const html = summaryHtml('commentary', 'Commentary', { cat: 'midrash' }, [], ['red', 'blue']);
    expect(text(html)).toBe('Commentary·midrash');
    expect(swatchColors(html)).toEqual(['red', 'blue']);
  });

  it('shows haftarah by name alone', () => {
    const html = summaryHtml('haftarah', 'Haftarah', { custom: 'sephardi' }, [], ['red', 'blue']);
    expect(text(html)).toBe('Haftarah');
    expect(swatchColors(html)).toEqual([]);
  });

  it('draws a gradient as a strip rather than a square', () => {
    const html = summaryHtml(
      'commentary',
      'Commentary',
      {},
      [],
      ['linear-gradient(red, blue)', 'red'],
    );
    const div = document.createElement('div');
    div.innerHTML = html;
    const shapes = [...div.querySelectorAll('.summary-swatch')].map((el) =>
      el.classList.contains('strip'),
    );
    expect(shapes).toEqual([true, false]);
  });

  it('keeps the line short when a legend draws many colours', () => {
    const many = Array.from({ length: 10 }, (_, i) => `rgb(${i}, 0, 0)`);
    expect(swatchColors(summaryHtml('text-dating', 'Text Dating', {}, [], many))).toHaveLength(6);
  });

  it('escapes what it shows', () => {
    const html = summaryHtml('search', '<b>', { q: '<i>' }, [], []);
    expect(html).not.toContain('<b>');
    expect(html).not.toContain('<i>');
  });
});

describe('drawnColors', () => {
  it('collects inline backgrounds and skips hidden swatches', () => {
    const div = document.createElement('div');
    div.innerHTML = `
      <span style="background: red"></span>
      <span style="background: blue; visibility: hidden"></span>
      <span style="color: green"></span>
      <span style="background-color: yellow"></span>`;
    expect(drawnColors(div)).toEqual(['red', 'yellow']);
  });

  it('is empty without a container', () => {
    expect(drawnColors(null)).toEqual([]);
  });
});
