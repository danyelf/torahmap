import { describe, it, expect } from 'vitest';
import { showLegend, type LegendRow } from '../src/mapLegend.ts';

function legend(): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML =
    ['search', 'overlay']
      .map((panel) => `<div class="map-legend-row" data-panel="${panel}" hidden></div>`)
      .join('') + '<div class="map-legend-warning" hidden></div>';
  return div;
}

const shownRows = (el: HTMLElement): (string | undefined)[] =>
  [...el.querySelectorAll<HTMLElement>('.map-legend-row')]
    .filter((row) => !row.hidden)
    .map((row) => row.dataset.panel);

const SEARCH: LegendRow = {
  panel: 'search',
  name: 'Search',
  summary: { terms: [{ text: 'אברם', color: 'cyan' }] },
};
const OVERLAY: LegendRow = { panel: 'overlay', name: 'Commentary', summary: {} };

describe('showLegend', () => {
  it('shows a row for each tool that is on, search first', () => {
    const el = legend();
    showLegend(el, [OVERLAY, SEARCH], []);
    expect(shownRows(el)).toEqual(['search', 'overlay']);
    expect(el.hidden).toBe(false);
  });

  it('names what each row shows', () => {
    const el = legend();
    showLegend(el, [SEARCH], []);
    expect(el.querySelector('[data-panel="search"]')!.textContent).toContain('אברם');
  });

  it('hides a row whose tool goes off', () => {
    const el = legend();
    showLegend(el, [SEARCH, OVERLAY], []);
    showLegend(el, [OVERLAY], []);
    expect(shownRows(el)).toEqual(['overlay']);
  });

  it('gives each shown row one button that opens its panel and one ×, however often it is shown', () => {
    const el = legend();
    showLegend(el, [SEARCH, OVERLAY], []);
    showLegend(el, [OVERLAY], []);
    showLegend(el, [SEARCH, OVERLAY], []);
    for (const row of el.querySelectorAll('.map-legend-row')) {
      expect(row.querySelectorAll('button.map-legend-open').length).toBe(1);
      expect(row.querySelectorAll('button.map-legend-close').length).toBe(1);
    }
  });

  it("names the overlay's × after the overlay it turns off", () => {
    const el = legend();
    showLegend(el, [OVERLAY], []);
    const close = el.querySelector('[data-panel="overlay"] .map-legend-close')!;
    expect(close.getAttribute('aria-label')).toContain('Commentary');
    showLegend(el, [{ ...OVERLAY, name: 'Haftarah' }], []);
    expect(close.getAttribute('aria-label')).toContain('Haftarah');
  });

  it('hides the card with neither on', () => {
    const el = legend();
    showLegend(el, [], []);
    expect(el.hidden).toBe(true);
  });

  it('marks a row whose files are on their way, and only that row', () => {
    const el = legend();
    showLegend(el, [SEARCH, { ...OVERLAY, loading: true }], []);
    expect(el.querySelector('[data-panel="overlay"]')!.hasAttribute('data-loading')).toBe(true);
    expect(el.querySelector('[data-panel="search"]')!.hasAttribute('data-loading')).toBe(false);
  });

  it('shows the warnings under the rows, the card with them, and hides the line when there are none', () => {
    const el = legend();
    const warnings = [document.createElement('span'), document.createElement('span')];
    showLegend(el, [], warnings);
    const line = el.querySelector<HTMLElement>('.map-legend-warning')!;
    expect(line.hidden).toBe(false);
    expect(warnings.every((w) => line.contains(w))).toBe(true);
    expect(el.hidden).toBe(false);
    showLegend(el, [], []);
    expect(line.hidden).toBe(true);
    expect(el.hidden).toBe(true);
  });
});
