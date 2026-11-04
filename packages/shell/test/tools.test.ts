import { describe, it, expect } from 'vitest';
import type { SearchTool } from '../src/app/search.ts';
import type { Overlay } from '../src/overlays/types.ts';
import {
  activeOverlay,
  emptyTools,
  fromLink,
  pickedTools,
  settingsIn,
  toLink,
  toolsChange,
  withActive,
  withOverlaySettings,
  withOverlayTrimmed,
  withReset,
  withSearch,
  type ToolState,
} from '../src/tools.ts';

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
const tools = { search, overlay: (id: string) => overlays.get(id) };
const empty = (): ToolState<Colors> => emptyTools(search);
const on = (id: string): ToolState<Colors> => withActive(empty(), tools, id);

/** An edit that adds `place` unless `taken` has it, as a tool's controls would. */
const add =
  (place: number) =>
  (current: Colors, taken: readonly number[]): Colors =>
    taken.includes(place) ? current : [...current, place];

describe('the colour rule', () => {
  it('keeps a pick out of the colours the search uses', () => {
    let state = withSearch(on('picks'), tools, add(3));
    state = withOverlaySettings(state, tools, picks, add(3));
    state = withOverlaySettings(state, tools, picks, add(4));
    expect(settingsIn(state, picks)).toEqual([4]);
  });

  it('keeps a search word out of the colours the overlay uses', () => {
    let state = withOverlaySettings(on('picks'), tools, picks, add(3));
    state = withSearch(state, tools, add(3));
    state = withSearch(state, tools, add(4));
    expect(state.search).toEqual([4]);
  });

  it('keeps a reset overlay out of the search colours', () => {
    const state = withSearch(empty(), tools, add(3));
    expect(settingsIn(state, defaulted)).toEqual([3]);
    expect(settingsIn(withReset(state, tools, defaulted), defaulted)).toEqual([]);
  });
});

describe('taking the tools from a link or a story stop', () => {
  it('takes the search first, so the overlay avoids its colours', () => {
    const state = fromLink(
      {
        overlay: 'picks',
        overlayParams: { picksColors: '1,2' },
        searchParams: { searchColors: '2,5' },
      },
      empty(),
      tools,
    );
    expect(activeOverlay(state, tools)).toBe(picks);
    expect(state.search).toEqual([2, 5]);
    expect(settingsIn(state, picks)).toEqual([1]);
  });

  it('replaces what was set rather than adding to it', () => {
    let state = fromLink({ overlay: 'picks', overlayParams: { picksColors: '1' } }, empty(), tools);
    state = withSearch(state, tools, add(2));
    state = fromLink({ overlay: 'picks' }, state, tools);
    expect(settingsIn(state, picks)).toEqual([]);
    expect(state.search).toEqual([]);
  });

  it('turns the overlay off for a link that names none, and keeps what each overlay held', () => {
    let state = withOverlaySettings(on('picks'), tools, picks, add(1));
    state = fromLink({ overlay: null, searchParams: { searchColors: '2' } }, state, tools);
    expect(state.active).toBeNull();
    expect(state.search).toEqual([2]);
    expect(settingsIn(withActive(state, tools, 'picks'), picks)).toEqual([1]);
  });

  it('keeps the settings of overlays the link does not name', () => {
    let state = withOverlaySettings(on('other'), tools, other, add(4));
    state = fromLink({ overlay: 'picks', overlayParams: { picksColors: '1' } }, state, tools);
    expect(settingsIn(state, other)).toEqual([4]);
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
    const lit = { search, overlay: () => highlighter };
    let state = withActive(empty(), lit, 'highlighter');
    state = withOverlaySettings(state, lit, highlighter, () => ({
      shade: 'cool',
      highlight: true,
    }));
    state = withOverlayTrimmed(state, lit);
    expect(settingsIn(state, highlighter)).toEqual({ shade: 'cool', highlight: false });
  });

  it("keeps the overlay out of the search's colours", () => {
    let state = withSearch(on('picks'), tools, add(2));
    // A story stop may set a colour the search holds; a link's overlay would avoid it.
    state = withOverlaySettings(state, tools, picks, () => [1, 2]);
    state = withOverlayTrimmed(state, tools);
    expect(settingsIn(state, picks)).toEqual([1]);
    expect(state.search).toEqual([2]);
  });

  it('is unchanged while no overlay is on', () => {
    const state = empty();
    expect(withOverlayTrimmed(state, tools)).toBe(state);
  });
});

describe('switching overlays', () => {
  it('keeps each overlay its settings while another is on', () => {
    let state = withOverlaySettings(on('picks'), tools, picks, add(1));
    state = withActive(state, tools, 'other');
    state = withOverlaySettings(state, tools, other, add(2));
    state = withActive(state, tools, 'picks');
    expect(settingsIn(state, picks)).toEqual([1]);
    state = withActive(state, tools, 'other');
    expect(settingsIn(state, other)).toEqual([2]);
  });

  it('turns the overlay off for an id nothing has', () => {
    expect(withActive(on('picks'), tools, 'none').active).toBeNull();
  });

  it('still takes an edit to an overlay that is not on', () => {
    const state = withOverlaySettings(on('other'), tools, picks, add(1));
    expect(settingsIn(state, picks)).toEqual([1]);
    expect(state.active).toBe('other');
  });

  it('stays the same value when switched to the overlay already on', () => {
    const state = on('picks');
    expect(withActive(state, tools, 'picks')).toBe(state);
  });
});

describe('what is picked', () => {
  it('lists the overlay, then the search while it searches', () => {
    expect(pickedTools(empty(), tools)).toEqual([]);
    expect(pickedTools(withSearch(on('picks'), tools, add(1)), tools)).toEqual([picks, search]);
  });
});

describe('the link', () => {
  it('writes the overlay and both tools’ parameters', () => {
    let state = withOverlaySettings(on('picks'), tools, picks, add(1));
    state = withSearch(state, tools, add(2));
    expect(toLink(state, tools)).toEqual({
      overlay: 'picks',
      overlayParams: { picksColors: '1' },
      searchParams: { searchColors: '2' },
    });
  });

  it('names no overlay while none is on', () => {
    expect(toLink(empty(), tools)).toEqual({ overlayParams: {}, searchParams: {} });
  });

  it('brings the tools back as they were', () => {
    let state = withOverlaySettings(on('picks'), tools, picks, add(1));
    state = withSearch(state, tools, add(2));
    const again = fromLink(toLink(state, tools), empty(), tools);
    expect(again.active).toBe('picks');
    expect(settingsIn(again, picks)).toEqual([1]);
    expect(again.search).toEqual([2]);
  });
});

describe('the value', () => {
  it('is frozen, so an edit made in place throws', () => {
    const inPlace = (current: Colors): Colors => {
      (current as number[]).push(1);
      return current;
    };
    expect(() => withOverlaySettings(on('picks'), tools, picks, inPlace)).toThrow(TypeError);
    expect(() => withSearch(on('picks'), tools, inPlace)).toThrow(TypeError);
  });
});

describe('what a change touched', () => {
  const nothing = {
    switched: false,
    settings: false,
    search: false,
    step: false,
    linked: { overlay: false, search: false },
  };
  const linked = (overlay: boolean, search: boolean) => ({ linked: { overlay, search } });

  it('sees a switch, which Back can undo', () => {
    const before = empty();
    expect(toolsChange(before, withActive(before, tools, 'picks'), tools)).toEqual({
      ...nothing,
      switched: true,
      step: true,
    });
  });

  it("sees an edit to the overlay's settings", () => {
    const before = on('picks');
    const after = withOverlaySettings(before, tools, picks, add(1));
    expect(toolsChange(before, after, tools)).toEqual({
      ...nothing,
      settings: true,
      ...linked(true, false),
    });
  });

  it('sees nothing in an edit to an overlay that is not on', () => {
    const before = on('other');
    const after = withOverlaySettings(before, tools, picks, add(1));
    expect(toolsChange(before, after, tools)).toEqual(nothing);
  });

  it('sees nothing in an edit that returns the settings it was given', () => {
    const before = on('picks');
    const after = withSearch(
      withOverlaySettings(before, tools, picks, (s) => s),
      tools,
      (s) => s,
    );
    expect(toolsChange(before, after, tools)).toEqual(nothing);
  });

  it('counts the search turning on or off as a step, and an edit to it not', () => {
    const off = empty();
    const searching = withSearch(off, tools, add(1));
    const more = withSearch(searching, tools, add(2));
    const searchLinked = linked(false, true);
    expect(toolsChange(off, searching, tools)).toEqual({
      ...nothing,
      search: true,
      step: true,
      ...searchLinked,
    });
    expect(toolsChange(searching, more, tools)).toEqual({
      ...nothing,
      search: true,
      ...searchLinked,
    });
    expect(toolsChange(more, off, tools)).toEqual({
      ...nothing,
      search: true,
      step: true,
      ...searchLinked,
    });
  });

  it('tells a link naming the same tools from one naming new ones', () => {
    const link = { overlay: 'picks', overlayParams: { picksColors: '1' } };
    const before = fromLink(link, empty(), tools);
    const again = fromLink(link, before, tools);
    const other = fromLink({ ...link, searchParams: { searchColors: '2' } }, before, tools);
    expect(toolsChange(before, again, tools)).toMatchObject(linked(false, false));
    expect(toolsChange(before, other, tools)).toMatchObject(linked(false, true));
  });
});
