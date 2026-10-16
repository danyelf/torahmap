import { describe, expect, it } from 'vitest';
import { talmudSearch, type TalmudSearchData } from '../src/search.ts';
import type { TalmudSearchText } from '../src/data.ts';
import { talmudFixture } from './helpers/talmudFixture.ts';

/** TractA's search text: its first amud says something, the rest says nothing much. */
const text: TalmudSearchText = {
  TractA: [
    ['אמר דרבי יוחנן', 'קל וחומר לדבר', 'זרבי', 'אחר', 'אחר'],
    ['אחר', 'אחר', 'אחר', 'אחר'],
    ['אחר', 'אחר', 'אחר', 'אחר', 'אחר', 'אחר'],
    ['רבי.', 'אחר', 'אחר'],
  ],
};
const data: TalmudSearchData = { structure: talmudFixture, text };

const segment = (id: string) => {
  const [tractate, page, n] = id.split('.');
  return {
    id,
    tractate,
    daf: Number(page.slice(0, -1)),
    amud: page.slice(-1) as 'a' | 'b',
    segment: Number(n),
    x: 0,
    y: 0,
    size: 1,
  };
};
const ITEMS = ['TractA.2a.1', 'TractA.2a.2', 'TractA.2a.3', 'TractA.3b.1'].map(segment);

const found = (params: Record<string, string>): string[] => {
  const settings = talmudSearch.settingsFromUrl!(params);
  const colors = talmudSearch.colorsFor(ITEMS, settings, null, data);
  return ITEMS.filter((_, i) => colors[i] !== null).map((item) => item.id);
};

describe('the Talmud’s search', () => {
  it('finds a whole word under a prefix, and not inside another word', () => {
    expect(found({ search: 'רבי', mode: 'w' })).toEqual(['TractA.2a.1', 'TractA.3b.1']);
  });

  it('finds a phrase', () => {
    expect(found({ search: 'קל וחומר' })).toEqual(['TractA.2a.2']);
  });

  it('keeps the search and its mode in the link', () => {
    const settings = talmudSearch.settingsFromUrl!({ search: 'רבי', mode: 'w' });
    expect(talmudSearch.settingsToUrl!(settings)).toEqual({ search: 'רבי', mode: 'w' });
  });

  it('marks nothing in popup text that abbreviates what search found', () => {
    const settings = talmudSearch.settingsFromUrl!({ search: 'רבי', mode: 'w' });
    const fragment = talmudSearch.highlightItemText!(
      ITEMS[0],
      'אמר ר׳ יוחנן',
      'he',
      settings,
      data,
    );
    const host = document.createElement('div');
    host.appendChild(fragment);
    expect(host.textContent).toBe('אמר ר׳ יוחנן');
    expect(host.querySelector('mark')).toBeNull();
  });

  it('draws its panel before its file is in, listing nothing', () => {
    const container = document.createElement('div');
    const settings = talmudSearch.settingsFromUrl!({ search: 'רבי' });
    talmudSearch.renderControls!(container, settings, () => {}, null);
    expect(container.querySelectorAll('.search-result')).toHaveLength(0);
    talmudSearch.destroy!();
  });
});
