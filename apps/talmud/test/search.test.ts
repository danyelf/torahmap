import { describe, expect, it } from 'vitest';
import { talmudSearch, type TalmudSearchData } from '../src/search.ts';
import { SEARCH_ENGLISH_FILE, type TalmudSearchText } from '../src/data.ts';
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
const data: TalmudSearchData = { structure: talmudFixture, text, english: null };

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
  const settings = talmudSearch.settingsFromUrl!(params, []);
  const colors = talmudSearch.colorsFor(ITEMS, settings, null, data);
  return ITEMS.filter((_, i) => colors[i] !== null).map((item) => item.id);
};

describe('the Talmud’s search', () => {
  it('finds a whole word under a prefix, and not inside another word', () => {
    expect(found({ search: 'רבי', mode: 'w' })).toEqual(['TractA.2a.1', 'TractA.3b.1']);
  });

  it('matches a term as a whole word until told otherwise', () => {
    expect(found({ search: 'רבי' })).toEqual(['TractA.2a.1', 'TractA.3b.1']);
    expect(found({ search: 'רבי', mode: 's' })).toEqual([
      'TractA.2a.1',
      'TractA.2a.3',
      'TractA.3b.1',
    ]);
  });

  it('finds a phrase', () => {
    expect(found({ search: 'קל וחומר' })).toEqual(['TractA.2a.2']);
  });

  it('keeps the search and its mode in the link', () => {
    const settings = talmudSearch.settingsFromUrl!({ search: 'רבי', mode: 'w' }, []);
    expect(talmudSearch.settingsToUrl!(settings)).toEqual({ search: 'רבי', mode: 'w' });
  });

  it('marks nothing in popup text that abbreviates what search found', () => {
    const settings = talmudSearch.settingsFromUrl!({ search: 'רבי', mode: 'w' }, []);
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
    const settings = talmudSearch.settingsFromUrl!({ search: 'רבי' }, []);
    talmudSearch.renderControls!(container, settings, () => {}, null);
    expect(container.querySelectorAll('.search-result')).toHaveLength(0);
    talmudSearch.destroy!();
  });
});

describe('the Talmud’s search in English', () => {
  const english: TalmudSearchText = {
    TractA: [['Rabbi Yoḥanan said', 'the ox that gored', 'nothing', '', ''], [], [], ['Rabbi Ami']],
  };
  const withEnglish: TalmudSearchData = { ...data, english };
  const foundIn = (d: TalmudSearchData, params: Record<string, string>): string[] => {
    const settings = talmudSearch.settingsFromUrl!(params, []);
    const colors = talmudSearch.colorsFor(ITEMS, settings, null, d);
    return ITEMS.filter((_, i) => colors[i] !== null).map((item) => item.id);
  };

  it('finds an English word, in either case', () => {
    expect(foundIn(withEnglish, { search: 'rabbi' })).toEqual(['TractA.2a.1', 'TractA.3b.1']);
  });

  it('finds an English phrase', () => {
    expect(foundIn(withEnglish, { search: 'Ox That Gored' })).toEqual(['TractA.2a.2']);
  });

  it('keeps searching Hebrew while the English is not in, and finds no English until it is', () => {
    expect(foundIn(data, { search: 'רבי' })).toEqual(['TractA.2a.1', 'TractA.3b.1']);
    expect(foundIn(data, { search: 'rabbi' })).toEqual([]);
  });

  it('searches Hebrew and English terms side by side', () => {
    const settings = talmudSearch.settingsFromUrl!({ search: 'קל וחומר,ami' }, []);
    const colors = talmudSearch.colorsFor(ITEMS, settings, null, withEnglish);
    expect(ITEMS.filter((_, i) => colors[i] !== null).map((item) => item.id)).toEqual([
      'TractA.2a.2',
      'TractA.3b.1',
    ]);
  });

  it('asks for the English file at once only for an English term', () => {
    const files = (search: string) =>
      talmudSearch.filesNow!(talmudSearch.settingsFromUrl!({ search }, []));
    expect(files('רבי')).toEqual([]);
    expect(files('a')).toEqual([]);
    expect(files('rabbi')).toEqual([SEARCH_ENGLISH_FILE]);
    expect(files('רבי,rabbi')).toEqual([SEARCH_ENGLISH_FILE]);
  });

  it('marks the popup’s English only inside the stretches it is told search reads', () => {
    const settings = talmudSearch.settingsFromUrl!({ search: 'rabbi' }, []);
    const text = 'Rabbi said: as Rabbi taught';
    const host = document.createElement('div');
    host.appendChild(
      talmudSearch.highlightItemText!(ITEMS[0], text, 'en', settings, withEnglish, [
        { start: 12, end: text.length },
      ]),
    );
    expect(host.textContent).toBe(text);
    const marks = [...host.querySelectorAll('mark')];
    expect(marks).toHaveLength(1);
    expect(host.firstChild!.textContent).toBe('Rabbi said: as ');
  });
});
