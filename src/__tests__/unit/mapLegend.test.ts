import { describe, it, expect } from 'vitest';
import { showLegend, type LegendRow } from '../../mapLegend';

function legend(): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = ['search', 'overlay']
    .map(
      (panel) =>
        `<button class="map-legend-row" data-panel="${panel}" hidden>` +
        `<span class="map-legend-summary"></span></button>`,
    )
    .join('');
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
    showLegend(el, [OVERLAY, SEARCH]);
    expect(shownRows(el)).toEqual(['search', 'overlay']);
    expect(el.hidden).toBe(false);
  });

  it('names what each row shows', () => {
    const el = legend();
    showLegend(el, [SEARCH]);
    expect(el.querySelector('[data-panel="search"]')!.textContent).toContain('אברם');
  });

  it('hides a row whose tool goes off', () => {
    const el = legend();
    showLegend(el, [SEARCH, OVERLAY]);
    showLegend(el, [OVERLAY]);
    expect(shownRows(el)).toEqual(['overlay']);
  });

  it('hides the card with neither on', () => {
    const el = legend();
    showLegend(el, []);
    expect(el.hidden).toBe(true);
  });
});
