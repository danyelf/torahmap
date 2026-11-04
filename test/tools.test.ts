import { describe, it, expect } from 'vitest';
import {
  emptyTools,
  fromLink,
  shownTools,
  toolsChange,
  withOverlaySettings,
} from '../packages/shell/src/tools.ts';
import { searchTool } from '@torahmap/tanakh/search/index.ts';
import { SAMPLE_LOADED, testOverlay } from '../apps/tanakh/test/helpers/fixtures.ts';

const counts = testOverlay({
  id: 'counts',
  name: 'Counts',
  data: { counts: 'counts.json' },
});
const tools = {
  search: searchTool,
  overlay: (id: string) => (id === 'counts' ? counts : undefined),
};

/** The tools with `overlay` on, if named, and the search on `words`. */
const toolsWith = (words: string, overlay?: string) =>
  fromLink({ overlay, searchParams: { search: words } }, emptyTools(searchTool), tools);

describe('shownTools', () => {
  it('shows the search once it has a word long enough to search on', () => {
    expect(shownTools(toolsWith('אור'), tools, SAMPLE_LOADED).search?.tool).toBe(searchTool);
  });

  it('leaves the search off for a single letter, or for nothing', () => {
    expect(shownTools(toolsWith('א'), tools, SAMPLE_LOADED).search).toBeNull();
    expect(shownTools(toolsWith(''), tools, SAMPLE_LOADED).search).toBeNull();
  });

  it('shows the overlay with its settings and data beside the search', () => {
    const settings = { category: 'total' };
    const loaded = new Map([...SAMPLE_LOADED, ['counts.json', { n: 1 }]]);
    const state = withOverlaySettings(toolsWith('אור', 'counts'), tools, counts, () => settings);
    const shown = shownTools(state, tools, loaded);
    expect(shown.overlay).toEqual({ tool: counts, settings, data: { counts: { n: 1 } } });
    expect(shown.search).not.toBeNull();
  });

  it('leaves out an overlay whose data is missing, and keeps the search', () => {
    const shown = shownTools(toolsWith('אור', 'counts'), tools, SAMPLE_LOADED);
    expect(shown.overlay).toBeNull();
    expect(shown.search?.tool).toBe(searchTool);
  });

  it('leaves the search out while its files are missing', () => {
    expect(shownTools(toolsWith('אור'), tools, new Map()).search).toBeNull();
  });
});

describe('a change to the search as a step Back can undo', () => {
  const at = (words: string) =>
    fromLink({ searchParams: { search: words } }, emptyTools(searchTool), tools);
  const step = (before: string, after: string) => toolsChange(at(before), at(after), tools).step;

  it('turns the search on with the first word long enough to search on', () => {
    expect(step('א', 'אב')).toBe(true);
  });

  it('does not count a lone letter', () => {
    expect(step('', 'א')).toBe(false);
  });

  it('edits, rather than toggles, as a word grows or another joins it', () => {
    expect(step('אב', 'אבר')).toBe(false);
    expect(step('אברם', 'אברם,אברהם')).toBe(false);
  });

  it('turns the search off when the last word goes', () => {
    expect(step('אברם', '')).toBe(true);
  });
});
