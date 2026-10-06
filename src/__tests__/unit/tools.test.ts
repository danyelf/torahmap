import { describe, it, expect } from 'vitest';
import { toolsShown, togglesSearch } from '../../tools';
import { searchTool } from '../../tanakh/search/index';
import { settingsFromLink } from '../../overlays/settings';
import { SAMPLE_LOADED, testOverlay } from '../helpers/fixtures';

const counts = testOverlay({
  id: 'counts',
  name: 'Counts',
  getVerseColor: () => null,
  data: { counts: 'counts.json' },
});

describe('toolsShown', () => {
  it('shows the search once it has a word long enough to search on', () => {
    expect(
      toolsShown(
        null,
        undefined,
        searchTool,
        settingsFromLink(searchTool, { search: 'אור' }),
        SAMPLE_LOADED,
      ).search?.tool,
    ).toBe(searchTool);
  });

  it('leaves the search off for a single letter, or for nothing', () => {
    expect(
      toolsShown(
        null,
        undefined,
        searchTool,
        settingsFromLink(searchTool, { search: 'א' }),
        new Map(),
      ).search,
    ).toBeNull();
    expect(
      toolsShown(null, undefined, searchTool, settingsFromLink(searchTool, {}), new Map()).search,
    ).toBeNull();
  });

  it('shows the overlay with its settings and data beside the search', () => {
    const settings = { category: 'total' };
    const loaded = new Map([...SAMPLE_LOADED, ['counts.json', { n: 1 }]]);
    const tools = toolsShown(
      counts,
      settings,
      searchTool,
      settingsFromLink(searchTool, { search: 'אור' }),
      loaded,
    );
    expect(tools.overlay).toEqual({ tool: counts, settings, data: { counts: { n: 1 } } });
    expect(tools.search).not.toBeNull();
  });

  it('leaves out an overlay whose data is missing, and keeps the search', () => {
    const tools = toolsShown(
      counts,
      undefined,
      searchTool,
      settingsFromLink(searchTool, { search: 'אור' }),
      SAMPLE_LOADED,
    );
    expect(tools.overlay).toBeNull();
    expect(tools.search?.tool).toBe(searchTool);
  });

  it('leaves the search out while its files are missing', () => {
    expect(
      toolsShown(
        null,
        undefined,
        searchTool,
        settingsFromLink(searchTool, { search: 'אור' }),
        new Map(),
      ).search,
    ).toBeNull();
  });
});

describe('togglesSearch', () => {
  const at = (words: string) => settingsFromLink(searchTool, { search: words });

  it('turns the search on with the first word long enough to search on', () => {
    expect(togglesSearch(at('א'), at('אב'))).toBe(true);
  });

  it('does not count a lone letter', () => {
    expect(togglesSearch(at(''), at('א'))).toBe(false);
  });

  it('edits, rather than toggles, as a word grows or another joins it', () => {
    expect(togglesSearch(at('אב'), at('אבר'))).toBe(false);
    expect(togglesSearch(at('אברם'), at('אברם,אברהם'))).toBe(false);
  });

  it('turns the search off when the last word goes', () => {
    expect(togglesSearch(at('אברם'), at(''))).toBe(true);
  });
});
