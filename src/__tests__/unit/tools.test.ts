import { describe, it, expect } from 'vitest';
import { toolsShown, togglesSearch } from '../../tools';
import { searchTool, searchFromLink } from '../../overlays/search/index';
import { commentaryOverlay } from '../../overlays/commentary';

describe('toolsShown', () => {
  it('shows the search once it has a word long enough to search on', () => {
    expect(toolsShown(null, undefined, searchFromLink({ search: 'אור' })).search?.tool).toBe(
      searchTool,
    );
  });

  it('leaves the search off for a single letter, or for nothing', () => {
    expect(toolsShown(null, undefined, searchFromLink({ search: 'א' })).search).toBeNull();
    expect(toolsShown(null, undefined, searchFromLink({})).search).toBeNull();
  });

  it('shows the overlay with its settings beside the search', () => {
    const settings = { category: 'total' };
    const tools = toolsShown(commentaryOverlay, settings, searchFromLink({ search: 'אור' }));
    expect(tools.overlay).toEqual({ tool: commentaryOverlay, settings });
    expect(tools.search).not.toBeNull();
  });
});

describe('togglesSearch', () => {
  const at = (words: string) => searchFromLink({ search: words });

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
