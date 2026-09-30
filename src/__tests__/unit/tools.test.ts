import { beforeAll, describe, it, expect } from 'vitest';
import { toolsShown, togglesSearch } from '../../tools';
import { ready } from '../../dataLoading';
import { countAsLoaded } from '../helpers/loading';
import { searchTool } from '../../overlays/search/index';
import { settingsFromLink } from '../../overlays/settings';
import { commentaryOverlay } from '../../overlays/commentary';

describe('toolsShown', () => {
  beforeAll(() => countAsLoaded(commentaryOverlay, searchTool));

  it('shows the search once it has a word long enough to search on', () => {
    expect(
      toolsShown(null, undefined, settingsFromLink(searchTool, { search: 'אור' })).search?.tool,
    ).toBe(searchTool);
  });

  it('leaves the search off for a single letter, or for nothing', () => {
    expect(
      toolsShown(null, undefined, settingsFromLink(searchTool, { search: 'א' })).search,
    ).toBeNull();
    expect(toolsShown(null, undefined, settingsFromLink(searchTool, {})).search).toBeNull();
  });

  it('shows the overlay with its settings beside the search', () => {
    const settings = { category: 'total' };
    const tools = toolsShown(
      commentaryOverlay,
      settings,
      settingsFromLink(searchTool, { search: 'אור' }),
    );
    expect(tools.overlay).toEqual({ tool: commentaryOverlay, settings });
    expect(tools.search).not.toBeNull();
  });
});

describe('toolsShown before the data arrives', () => {
  it('leaves an overlay off until its init has finished', async () => {
    let finish!: () => void;
    const overlay = { ...commentaryOverlay, init: () => new Promise<void>((r) => (finish = r)) };
    const settings = { category: 'total' };
    const loading = ready(overlay);

    expect(toolsShown(overlay, settings, settingsFromLink(searchTool, {})).overlay).toBeNull();
    finish();
    await loading;
    expect(toolsShown(overlay, settings, settingsFromLink(searchTool, {})).overlay).not.toBeNull();
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
