// The per-word parse lands after the rest of search's files, and marks a word
// better than its spelling: the results already listed are quoted again, in
// place.
import { afterEach, describe, expect, it } from 'vitest';
import { requoteSearchResults, searchTool } from '../../../overlays/search/index';
import { addTerm } from '../../../search/terms';
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

  it('marks by the parse once it lands, keeping the panel', () => {
    const container = document.createElement('div');
    // Genesis 19:28 has both עַל and עָלָה; only the parse tells them apart.
    searchTool.renderControls!(container, { terms: addTerm([], 'עלה') }, () => {}, {
      ...files,
      parse: null,
    });
    const input = container.querySelector('.term-input');
    expect(markIn(container, '19:28')).toBe('עַל');

    requoteSearchResults(files);

    expect(markIn(container, '19:28')).toBe('עָלָה');
    expect(container.querySelector('.term-input')).toBe(input);
  });
});
