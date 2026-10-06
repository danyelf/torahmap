// The per-word parse lands after the rest of search's files, and marks a word
// better than its spelling: the results already listed are quoted again, in
// place, so the reader keeps their place in the list.
import { afterEach, describe, expect, it } from 'vitest';
import { searchTool } from '../../../tanakh/search/index';
import { addTerm } from '../../../tanakh/search/terms';
import { realSearchData } from '../../helpers/searchData';

const { files } = realSearchData();

/** The marked word of the listed verse whose reference ends with `ref`. */
function markIn(container: HTMLElement, ref: string): string | null {
  const row = [...container.querySelectorAll('.search-result')].find((r) =>
    r.querySelector('.ref')!.textContent!.endsWith(ref),
  );
  return row?.querySelector('mark')?.textContent ?? null;
}

describe('requoting the search results', () => {
  afterEach(() => searchTool.destroy?.());

  it('marks by the parse once it lands, keeping the list where the reader scrolled it', () => {
    const container = document.createElement('div');
    // Genesis 19:28 has both עַל and עָלָה; only the parse tells them apart.
    const settings = { terms: addTerm([], 'עלה') };
    searchTool.renderControls!(container, settings, () => {}, { ...files, parse: null });
    expect(markIn(container, '19:28')).toBe('עַל');
    const list = container.querySelector('#search-results')!;
    list.scrollTop = 120;

    searchTool.renderControls!(container, settings, () => {}, files);

    expect(markIn(container, '19:28')).toBe('עָלָה');
    expect(list.scrollTop).toBe(120);
  });
});
