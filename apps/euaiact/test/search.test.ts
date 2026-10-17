import { describe, expect, it } from 'vitest';
import type { ActItem } from '../src/layout.ts';
import { ENGLISH } from '@torahmap/shell/language.ts';
import { AMENDED } from '../src/overlays/amendment.ts';
import { actSearch, wordMatcher } from '../src/search.ts';

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
const texts = {
  'Recital.1': 'Deployers should keep records, as in point (a).',
  '9(2)': 'The provider shall keep records of the system.',
  '9(3)': 'Nothing here.',
};
const colours = (text: string) =>
  actSearch.colorsFor([item('Recital.1', 'recital'), item('9(2)'), item('9(3)')], { text }, null, {
    texts,
  });

describe('searching the Act for a word', () => {
  it('colours every paragraph that has the word, in a recital or an article', () => {
    const [recital, article, none] = colours('records');
    expect(recital).not.toBeNull();
    expect(article).not.toBeNull();
    expect(none).toBeNull();
  });

  it('matches a whole word, in any case', () => {
    expect(colours('RECORD').every((c) => c === null)).toBe(true);
    expect(colours('Provider')[1]).not.toBeNull();
  });

  it('finds nothing for a single letter', () => {
    expect(colours('a').every((c) => c === null)).toBe(true);
    expect(actSearch.isSearching({ text: 'a' })).toBe(false);
  });

  it('finds nothing for a single letter with punctuation round it', () => {
    for (const text of ['(a', 'a.', '(a)']) {
      expect(actSearch.isSearching({ text })).toBe(false);
      expect(colours(text).every((c) => c === null)).toBe(true);
    }
  });

  it('treats what a reader types as letters, not as a pattern', () => {
    expect(() => colours('(a')).not.toThrow();
    expect(wordMatcher('a.b')?.test('a-b')).toBe(false);
  });

  it('colours a hit apart from every colour the Amendment overlay paints', () => {
    const hit = colours('records')[1];
    for (const { plain, lead } of Object.values(AMENDED)) {
      expect(hit).not.toEqual(plain);
      expect(hit).not.toEqual(lead);
    }
  });

  it('marks each whole-word match in a paragraph’s text, in any case', () => {
    const text = 'Records, recordsets and RECORDS.';
    const marked = (word: string) => {
      const div = document.createElement('div');
      div.append(
        actSearch.highlightItemText!(
          item('9(2)'),
          text,
          ENGLISH,
          { text: word },
          {
            texts,
          },
        ),
      );
      return div;
    };
    const div = marked('records');
    expect([...div.querySelectorAll('mark')].map((m) => m.textContent)).toEqual([
      'Records',
      'RECORDS',
    ]);
    expect(div.textContent).toBe(text);
    expect(marked('a').querySelectorAll('mark')).toHaveLength(0);
  });

  it('reads its word from a link and writes it back', () => {
    expect(actSearch.settingsFromUrl!({ search: 'records' })).toEqual({ text: 'records' });
    expect(actSearch.settingsToUrl!({ text: ' records ' })).toEqual({ search: 'records' });
    expect(actSearch.settingsToUrl!({ text: '' })).toEqual({});
  });
});
