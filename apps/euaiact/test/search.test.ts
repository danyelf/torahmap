import { describe, expect, it } from 'vitest';
import type { ActItem } from '../src/layout.ts';
import { ENGLISH } from '@torahmap/shell/language.ts';
import { AMENDED } from '../src/overlays/amendment.ts';
import { actSearch, type ActSearchData } from '../src/search.ts';

const item = (id: string, layer: ActItem['layer'] = 'article'): ActItem => ({
  id,
  x: 0,
  y: 0,
  size: 6,
  layer,
  origin: 'B',
  lead: false,
  chapter: 'I',
});
const data: ActSearchData = {
  texts: {
    'Recital.1': 'Deployers should keep records, as in point (a).',
    '9(2)': 'The provider shall keep records of the system.',
    '9(3)': 'Nothing here.',
  },
};
const ITEMS = [item('Recital.1', 'recital'), item('9(2)'), item('9(3)')];
const colours = (params: Record<string, string>) =>
  actSearch.colorsFor(ITEMS, actSearch.settingsFromUrl!(params), null, data);
const found = (params: Record<string, string>) =>
  colours(params).flatMap((c, i) => (c ? [ITEMS[i].id] : []));

describe('searching the Act', () => {
  it('colours every paragraph that has the word, in a recital or an article', () => {
    expect(found({ search: 'records' })).toEqual(['Recital.1', '9(2)']);
  });

  it('matches a substring, in any case, until told otherwise', () => {
    expect(found({ search: 'RECORD' })).toEqual(['Recital.1', '9(2)']);
    expect(found({ search: 'Provider' })).toEqual(['9(2)']);
    expect(found({ search: 'deploy' })).toEqual(['Recital.1']);
    expect(found({ search: 'deploy', mode: 'w' })).toEqual([]);
  });

  it('colours each term apart, and a paragraph by the terms it has', () => {
    const [recital, article, none] = colours({ search: 'deployers,provider' });
    expect(recital).not.toBeNull();
    expect(article).not.toBeNull();
    expect(recital).not.toEqual(article);
    expect(none).toBeNull();
  });

  it('finds nothing for a single letter', () => {
    expect(found({ search: 'a' })).toEqual([]);
    expect(actSearch.isSearching(actSearch.settingsFromUrl!({ search: 'a' }))).toBe(false);
  });

  it('treats what a reader types as letters, not as a pattern', () => {
    expect(() => colours({ search: '(a' })).not.toThrow();
    expect(found({ search: 'point (a)' })).toEqual(['Recital.1']);
  });

  it('colours a hit apart from every colour the Amendment overlay paints', () => {
    const hit = colours({ search: 'records' })[1];
    for (const { plain, lead } of Object.values(AMENDED)) {
      expect(hit).not.toEqual(plain);
      expect(hit).not.toEqual(lead);
    }
  });

  it('marks each match in a paragraph’s text, in any case', () => {
    const text = 'Records, recordsets and RECORDS.';
    const div = document.createElement('div');
    const settings = actSearch.settingsFromUrl!({ search: 'records' });
    div.append(actSearch.highlightItemText!(item('9(2)'), text, ENGLISH, settings, data));
    expect([...div.querySelectorAll('mark')].map((m) => m.textContent)).toEqual([
      'Records',
      'records',
      'RECORDS',
    ]);
    expect(div.textContent).toBe(text);
  });

  it('lists each paragraph found with an excerpt of its match', () => {
    const container = document.createElement('div');
    const settings = actSearch.settingsFromUrl!({ search: 'records,provider' });
    actSearch.renderControls!(container, settings, () => {}, data);
    const rows = [...container.querySelectorAll('.search-result')];
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row.querySelector('.snippet mark')).not.toBeNull();
    actSearch.destroy!();
  });

  it('keeps its terms and their modes in the link', () => {
    const link = actSearch.settingsToUrl!(
      actSearch.settingsFromUrl!({ search: 'provider,deploy', mode: 'w,w' }),
    );
    expect(found(link)).toEqual(['9(2)']);
    expect(found({ search: link.search })).toEqual(['Recital.1', '9(2)']);
  });
});
