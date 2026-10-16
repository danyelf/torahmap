import { describe, expect, it } from 'vitest';
import { buildTextIndex, createTermSearch, english, type TermSettings } from '../src/index.ts';
import { TERM_SEARCH_PARAMS } from '@torahmap/link';

interface Data {
  readonly lines: Record<string, string>;
}

const data: Data = { lines: { a: 'alpha beta', b: 'gamma delta', c: 'gammas' } };
const items = Object.keys(data.lines).map((id) => ({ id, x: 0, y: 0, size: 1 }));

const index = buildTextIndex(
  Object.entries(data.lines).map(([id, en]) => ({ id, ref: `Line ${id}`, text: { en } })),
  [english],
);

const search = createTermSearch<{ id: string }, Data>({
  languages: [english],
  data: { lines: 'lines.json' },
  index: () => index,
  noun: { one: 'line', many: 'lines' },
  placeholder: 'Search…',
  description: 'Any word.',
  urlParams: TERM_SEARCH_PARAMS,
});

const fromLink = (params: Record<string, string>): TermSettings =>
  search.tool.settingsFromUrl!(params);

describe('a term search with no extra mode', () => {
  it('reads and writes its terms and their modes in the link', () => {
    const settings = fromLink({ search: 'gamma', mode: 'w' });
    expect(search.tool.settingsToUrl!(settings)).toEqual({ search: 'gamma', mode: 'w' });
  });

  it('colours the items a whole word finds, and only those', () => {
    const settings = fromLink({ search: 'gamma', mode: 'w' });
    const colors = search.tool.colorsFor(items, settings, null, data);
    expect(colors.map((c) => c !== null)).toEqual([false, true, false]);
  });

  it('finds a substring inside longer words by default', () => {
    const settings = fromLink({ search: 'gamma' });
    const colors = search.tool.colorsFor(items, settings, null, data);
    expect(colors.map((c) => c !== null)).toEqual([false, true, true]);
  });

  it('counts its results by its own noun', () => {
    const container = document.createElement('div');
    search.tool.renderControls!(container, fromLink({ search: 'gamma' }), () => {}, data);
    expect(container.querySelector('#search-hit-caption')!.textContent).toBe('2 matching lines');
    search.tool.destroy!();
  });

  it('hands a clicked result back as its item', () => {
    let picked: string | null = null;
    search.configure(items, (item) => (picked = item.id));
    const container = document.createElement('div');
    search.tool.renderControls!(container, fromLink({ search: 'delta' }), () => {}, data);
    container.querySelector<HTMLElement>('.search-result')!.click();
    expect(picked).toBe('b');
    search.tool.destroy!();
  });
});
