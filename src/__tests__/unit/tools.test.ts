import { describe, it, expect } from 'vitest';
import { toolsShown } from '../../tools';
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
