import { describe, it, expect } from 'vitest';
import type { SearchTool } from '../src/app/search.ts';
import type { Overlay } from '../src/overlays/types.ts';
import { createToolsState } from '../src/toolsState.ts';

// A tool's settings are the palette places it uses, which a link carries as `colors=1,2`.
type Colors = readonly number[];

const parseColors = (value: string | undefined): Colors =>
  value ? value.split(',').map(Number) : [];

/** A tool that draws in the colours it is set to; an edit to it moves off `taken`. */
function paletteTool(id: string, defaultColors = ''): Overlay<object, Colors> {
  return {
    id,
    name: id,
    urlParams: [{ key: `${id}Colors`, kind: 'text', default: defaultColors }],
    settingsFromUrl: (params, taken) => {
      const wanted = parseColors(params[`${id}Colors`]);
      return wanted.filter((place) => !taken.includes(place));
    },
    settingsToUrl: (colors) => ({ [`${id}Colors`]: colors.join(',') }),
    colorsInUse: (colors) => colors,
    colorsFor: () => [],
  };
}

const search: SearchTool<object, Colors> = {
  ...paletteTool('search'),
  isSearching: (colors) => colors.length > 0,
  telemetry: { readerChanged() {}, replaced() {}, dataLoaded() {} },
};
const picks = paletteTool('picks');
const other = paletteTool('other');
const defaulted = paletteTool('defaulted', '3');

const overlays = new Map([picks, other, defaulted].map((overlay) => [overlay.id, overlay]));
const newState = () => createToolsState<object, Colors>(search, (id) => overlays.get(id));

/** An edit that adds `place` unless `taken` has it, as a tool's controls would. */
const add =
  (place: number) =>
  (current: Colors, taken: readonly number[]): Colors =>
    taken.includes(place) ? current : [...current, place];

describe('the colour rule', () => {
  it('keeps a pick out of the colours the search uses', () => {
    const state = newState();
    state.switchTo('picks');
    state.changeSearch(add(3));
    state.changeOverlay(picks, add(3));
    state.changeOverlay(picks, add(4));
    expect(state.settingsOf(picks)).toEqual([4]);
  });

  it('keeps a search word out of the colours the overlay uses', () => {
    const state = newState();
    state.switchTo('picks');
    state.changeOverlay(picks, add(3));
    state.changeSearch(add(3));
    state.changeSearch(add(4));
    expect(state.searchSettings()).toEqual([4]);
  });

  it('keeps a reset overlay out of the search colours', () => {
    const state = newState();
    state.changeSearch(add(3));
    expect(state.settingsOf(defaulted)).toEqual([3]);
    state.reset(defaulted);
    expect(state.settingsOf(defaulted)).toEqual([]);
  });
});

describe('restoring from a link or a story stop', () => {
  it('restores the search first, so the overlay avoids its colours', () => {
    const state = newState();
    state.switchTo('picks');
    state.restore({ picksColors: '1,2' }, { searchColors: '2,5' });
    expect(state.searchSettings()).toEqual([2, 5]);
    expect(state.settingsOf(picks)).toEqual([1]);
  });

  it('replaces what was set rather than adding to it', () => {
    const state = newState();
    state.switchTo('picks');
    state.restore({ picksColors: '1' }, { searchColors: '2' });
    state.restore({}, {});
    expect(state.settingsOf(picks)).toEqual([]);
    expect(state.searchSettings()).toEqual([]);
  });

  it('restores only the search while no overlay is on', () => {
    const state = newState();
    state.restore({ picksColors: '1' }, { searchColors: '2' });
    expect(state.searchSettings()).toEqual([2]);
    state.switchTo('picks');
    expect(state.settingsOf(picks)).toEqual([]);
  });
});

describe('leaving a story', () => {
  // A story stop can set what a link has no room for, such as a highlight.
  const highlighter: Overlay<object, { shade: string; highlight: boolean }> = {
    id: 'highlighter',
    name: 'highlighter',
    urlParams: [{ key: 'shade', kind: 'text', default: 'warm' }],
    settingsFromUrl: (params) => ({ shade: params.shade ?? 'warm', highlight: false }),
    settingsToUrl: ({ shade }) => ({ shade }),
    colorsFor: () => [],
  };

  it('keeps of the overlay only what a link carries', () => {
    const state = createToolsState<object, Colors>(search, () => highlighter);
    state.switchTo('highlighter');
    state.changeOverlay(highlighter, () => ({ shade: 'cool', highlight: true }));
    expect(state.keepOnlyLinked()).toBe(true);
    expect(state.settingsOf(highlighter)).toEqual({ shade: 'cool', highlight: false });
  });

  it("keeps the overlay out of the search's colours", () => {
    const state = newState();
    state.switchTo('picks');
    state.changeSearch(add(2));
    // A story stop may set a colour the search holds; a link's overlay would avoid it.
    state.changeOverlay(picks, () => [1, 2]);
    state.keepOnlyLinked();
    expect(state.settingsOf(picks)).toEqual([1]);
    expect(state.searchSettings()).toEqual([2]);
  });

  it('has nothing to keep while no overlay is on', () => {
    expect(newState().keepOnlyLinked()).toBe(false);
  });
});

describe('switching overlays', () => {
  it('keeps each overlay its settings while another is on', () => {
    const state = newState();
    state.switchTo('picks');
    state.changeOverlay(picks, add(1));
    state.switchTo('other');
    state.changeOverlay(other, add(2));
    state.switchTo('picks');
    expect(state.settingsOf(picks)).toEqual([1]);
    state.switchTo('other');
    expect(state.settingsOf(other)).toEqual([2]);
  });

  it('turns the overlay off for an id nothing has, and names it none', () => {
    const state = newState();
    state.switchTo('picks');
    expect(state.overlayId()).toBe('picks');
    state.switchTo('none');
    expect(state.overlay()).toBeNull();
    expect(state.overlayId()).toBe('none');
    expect(state.settingsOfOverlayOn()).toBeUndefined();
  });

  it('still takes a reader’s edit to an overlay that is not on', () => {
    const state = newState();
    state.switchTo('other');
    state.changeOverlay(picks, add(1));
    expect(state.settingsOf(picks)).toEqual([1]);
    expect(state.overlay()).toBe(other);
  });
});

describe('what is picked', () => {
  it('lists the overlay, then the search while it searches', () => {
    const state = newState();
    expect(state.picked()).toEqual([]);
    expect(state.searching()).toBe(false);
    state.switchTo('picks');
    state.changeSearch(add(1));
    expect(state.searching()).toBe(true);
    expect(state.picked()).toEqual([picks, search]);
  });
});

describe('the link', () => {
  it('writes the overlay and both tools’ parameters', () => {
    const state = newState();
    state.switchTo('picks');
    state.changeOverlay(picks, add(1));
    state.changeSearch(add(2));
    expect(state.toUrl()).toEqual({
      overlay: 'picks',
      overlayParams: { picksColors: '1' },
      searchParams: { searchColors: '2' },
    });
  });

  it('names no overlay while none is on', () => {
    const state = newState();
    expect(state.toUrl()).toEqual({ overlayParams: {}, searchParams: {} });
  });
});

describe('a reader’s edit to the search', () => {
  it('reports the settings before and after', () => {
    const state = newState();
    expect(state.changeSearch(add(1))).toEqual({ before: [], after: [1] });
  });
});
